import type { ApiCollectionRecord, ApiCookieRecord, ApiEnvironmentRecord, ApiHistoryRecord, ApiImportPayload, ApiOrderItem, ApiRequestRecord } from "@vessel/type/api-client"
import Database from "better-sqlite3"
import { randomUUID } from "node:crypto"
export type { ApiCollectionRecord, ApiCookieRecord, ApiEnvironmentRecord, ApiHistoryRecord, ApiRequestRecord } from "@vessel/type/api-client"

const REQUEST_COLUMNS = "id, collection_id as collectionId, name, method, url, headers, params, body_type as bodyType, body_content as bodyContent, raw_type as rawType, auth_type as authType, auth_config as authConfig, tests, pre_request as preRequest, sort_order as sortOrder, updated_at as updatedAt"

export class ApiClientStore {
  private db: Database.Database

  /** Initializes the instance and its required dependencies. */
  constructor(dbPath: string) {
    this.db = new Database(dbPath)
    this.db.pragma("journal_mode = WAL")
    this.initTables()
  }

  /** Initializes tables. */
  private initTables(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS api_collections (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        parent_id TEXT,
        created_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS api_requests (
        id TEXT PRIMARY KEY,
        collection_id TEXT,
        name TEXT NOT NULL,
        method TEXT NOT NULL,
        url TEXT NOT NULL,
        headers TEXT NOT NULL,
        params TEXT NOT NULL,
        body_type TEXT NOT NULL,
        body_content TEXT NOT NULL,
        auth_type TEXT NOT NULL,
        auth_config TEXT NOT NULL,
        tests TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS api_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        method TEXT NOT NULL,
        url TEXT NOT NULL,
        status INTEGER NOT NULL,
        status_text TEXT NOT NULL,
        duration_ms INTEGER NOT NULL,
        size_bytes INTEGER NOT NULL,
        request_data TEXT NOT NULL,
        response_preview TEXT,
        created_at INTEGER NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_api_history_created_at ON api_history(created_at DESC);

      CREATE TABLE IF NOT EXISTS api_environments (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        variables TEXT NOT NULL,
        is_active INTEGER NOT NULL DEFAULT 0
      );

      CREATE TABLE IF NOT EXISTS api_cookies (
        domain TEXT NOT NULL,
        path TEXT NOT NULL,
        name TEXT NOT NULL,
        value TEXT NOT NULL,
        expires INTEGER,
        secure INTEGER NOT NULL DEFAULT 0,
        http_only INTEGER NOT NULL DEFAULT 0,
        PRIMARY KEY (domain, path, name)
      );
    `)
    this.addColumn("api_requests", "raw_type", "TEXT")
    this.addColumn("api_requests", "pre_request", "TEXT NOT NULL DEFAULT ''")
    this.addColumn("api_requests", "sort_order", "INTEGER NOT NULL DEFAULT 0")
    this.addColumn("api_collections", "sort_order", "INTEGER NOT NULL DEFAULT 0")

    // 初始化默认环境（如果为空）
    const count = (this.db.prepare("SELECT COUNT(*) as c FROM api_environments").get() as { c: number }).c
    if (count === 0) {
      this.saveEnvironment({
        id: "env-dev",
        name: "Dev 环境",
        variables: JSON.stringify([{ key: "baseUrl", value: "https://jsonplaceholder.typicode.com", enabled: true }]),
        isActive: true
      })
      this.saveEnvironment({
        id: "env-prod",
        name: "Prod 生产环境",
        variables: JSON.stringify([{ key: "baseUrl", value: "https://api.github.com", enabled: true }]),
        isActive: false
      })
    }
  }

  /** Adds a column to an existing table when an older database lacks it. */
  private addColumn(table: string, column: string, definition: string): void {
    const columns = this.db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[]
    if (!columns.some((item) => item.name === column)) this.db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`)
  }

  /** Next sort slot among siblings of the same parent. */
  private nextOrder(table: "api_collections" | "api_requests", parentColumn: "parent_id" | "collection_id", parentId: string | null): number {
    const row = this.db.prepare(`SELECT MAX(sort_order) as m FROM ${table} WHERE ${parentColumn} IS ?`).get(parentId) as { m: number | null }
    return (row.m ?? -1) + 1
  }

  // --- Collections ---

  /** Lists collections. */
  listCollections(): ApiCollectionRecord[] {
    return this.db.prepare("SELECT id, name, parent_id as parentId, created_at as createdAt, sort_order as sortOrder FROM api_collections ORDER BY sort_order ASC, created_at ASC").all() as ApiCollectionRecord[]
  }

  /** Saves collection. */
  saveCollection(record: { id: string; name: string; parentId?: string | null }): ApiCollectionRecord[] {
    const existing = this.db.prepare("SELECT id FROM api_collections WHERE id = ?").get(record.id)
    if (existing) {
      this.db.prepare("UPDATE api_collections SET name = ?, parent_id = ? WHERE id = ?").run(record.name, record.parentId || null, record.id)
    } else {
      const parentId = record.parentId || null
      this.db.prepare("INSERT INTO api_collections (id, name, parent_id, created_at, sort_order) VALUES (?, ?, ?, ?, ?)").run(record.id, record.name, parentId, Date.now(), this.nextOrder("api_collections", "parent_id", parentId))
    }
    return this.listCollections()
  }

  /** Deletes collection. */
  deleteCollection(id: string): ApiCollectionRecord[] {
    const all = this.listCollections()
    const ids = new Set([id])
    for (let grew = true; grew; ) {
      grew = false
      for (const item of all) if (item.parentId && ids.has(item.parentId) && !ids.has(item.id)) { ids.add(item.id); grew = true }
    }
    this.db.transaction(() => {
      for (const item of ids) {
        this.db.prepare("DELETE FROM api_requests WHERE collection_id = ?").run(item)
        this.db.prepare("DELETE FROM api_collections WHERE id = ?").run(item)
      }
    })()
    return this.listCollections()
  }

  /** Persists drag-and-drop ordering and re-parenting for collections, folders and requests. */
  reorder(items: ApiOrderItem[]): void {
    const collections = this.listCollections()
    this.db.transaction(() => {
      for (const item of items) {
        if (item.kind === "collection") {
          let parent = item.parentId
          while (parent) {
            if (parent === item.id) throw new Error("不能把文件夹移动到它自身内部")
            parent = collections.find((entry) => entry.id === parent)?.parentId ?? null
          }
          this.db.prepare("UPDATE api_collections SET parent_id = ?, sort_order = ? WHERE id = ?").run(item.parentId, item.sortOrder, item.id)
        } else {
          this.db.prepare("UPDATE api_requests SET collection_id = ?, sort_order = ? WHERE id = ?").run(item.parentId, item.sortOrder, item.id)
        }
      }
    })()
  }

  /** Bulk import (e.g. a Postman collection) in one transaction. */
  importItems(payload: ApiImportPayload): void {
    this.db.transaction(() => {
      payload.collections.forEach((item, index) => {
        this.db.prepare("INSERT INTO api_collections (id, name, parent_id, created_at, sort_order) VALUES (?, ?, ?, ?, ?)").run(item.id, item.name, item.parentId, Date.now(), item.parentId ? index : this.nextOrder("api_collections", "parent_id", null))
      })
      payload.requests.forEach((item, index) => this.saveRequest({ ...item, sortOrder: item.sortOrder ?? index }))
    })()
  }

  // --- Requests ---

  /** Lists requests. */
  listRequests(collectionId?: string): ApiRequestRecord[] {
    const rows = (collectionId
      ? this.db.prepare(`SELECT ${REQUEST_COLUMNS} FROM api_requests WHERE collection_id = ? ORDER BY sort_order ASC, updated_at DESC`).all(collectionId)
      : this.db.prepare(`SELECT ${REQUEST_COLUMNS} FROM api_requests ORDER BY sort_order ASC, updated_at DESC`).all()) as (ApiRequestRecord & { rawType: ApiRequestRecord["rawType"] | null })[]
    return rows.map((row) => ({ ...row, rawType: row.rawType ?? undefined, preRequest: row.preRequest ?? "" }))
  }

  /** Saves request. */
  saveRequest(record: ApiRequestRecord): ApiRequestRecord {
    const existing = this.db.prepare("SELECT sort_order as sortOrder, collection_id as collectionId FROM api_requests WHERE id = ?").get(record.id) as { sortOrder: number; collectionId: string | null } | undefined
    const collectionId = record.collectionId || null
    const sortOrder = record.sortOrder ?? (existing && existing.collectionId === collectionId ? existing.sortOrder : this.nextOrder("api_requests", "collection_id", collectionId))
    const values = [collectionId, record.name, record.method, record.url, record.headers, record.params, record.bodyType, record.bodyContent, record.rawType ?? null, record.authType, record.authConfig, record.tests, record.preRequest ?? "", sortOrder, Date.now()]
    if (existing) {
      this.db
        .prepare("UPDATE api_requests SET collection_id = ?, name = ?, method = ?, url = ?, headers = ?, params = ?, body_type = ?, body_content = ?, raw_type = ?, auth_type = ?, auth_config = ?, tests = ?, pre_request = ?, sort_order = ?, updated_at = ? WHERE id = ?")
        .run(...values, record.id)
    } else {
      this.db
        .prepare("INSERT INTO api_requests (collection_id, name, method, url, headers, params, body_type, body_content, raw_type, auth_type, auth_config, tests, pre_request, sort_order, updated_at, id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
        .run(...values, record.id)
    }
    return { ...record, collectionId, sortOrder }
  }

  /** Duplicates a saved request right after the original. */
  duplicateRequest(id: string): ApiRequestRecord {
    const source = this.listRequests().find((item) => item.id === id)
    if (!source) throw new Error("请求不存在")
    const siblings = this.listRequests().filter((item) => item.collectionId === source.collectionId && (item.sortOrder ?? 0) > (source.sortOrder ?? 0))
    this.db.transaction(() => {
      for (const item of siblings) this.db.prepare("UPDATE api_requests SET sort_order = sort_order + 1 WHERE id = ?").run(item.id)
    })()
    return this.saveRequest({ ...source, id: `req-${randomUUID()}`, name: `${source.name} 副本`, sortOrder: (source.sortOrder ?? 0) + 1 })
  }

  /** Deletes request. */
  deleteRequest(id: string): void {
    this.db.prepare("DELETE FROM api_requests WHERE id = ?").run(id)
  }

  // --- History ---

  /** Lists history. */
  listHistory(limit = 100): ApiHistoryRecord[] {
    return this.db
      .prepare(
        `
      SELECT
        id, method, url, status, status_text as statusText, duration_ms as durationMs,
        size_bytes as sizeBytes, request_data as requestData, response_preview as responsePreview, created_at as createdAt
      FROM api_history
      ORDER BY created_at DESC
      LIMIT ?
    `
      )
      .all(limit) as ApiHistoryRecord[]
  }

  /** Adds history. */
  addHistory(entry: Omit<ApiHistoryRecord, "id">): ApiHistoryRecord {
    const res = this.db
      .prepare(
        `
      INSERT INTO api_history (method, url, status, status_text, duration_ms, size_bytes, request_data, response_preview, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `
      )
      .run(entry.method, entry.url, entry.status, entry.statusText, entry.durationMs, entry.sizeBytes, entry.requestData, entry.responsePreview || "", entry.createdAt || Date.now())
    return { ...entry, id: Number(res.lastInsertRowid) }
  }

  /** Clears history. */
  clearHistory(): void {
    this.db.prepare("DELETE FROM api_history").run()
  }

  /** Deletes the request group represented by one deduplicated history row. */
  deleteHistoryRequest(method: string, url: string): void {
    if (typeof method !== "string" || typeof url !== "string") throw new Error("历史记录参数无效")
    this.db.prepare("DELETE FROM api_history WHERE UPPER(method) = ? AND url = ?").run(method.toUpperCase(), url)
  }

  /** Deletes history. */
  deleteHistory(id: number): void {
    this.db.prepare("DELETE FROM api_history WHERE id = ?").run(id)
  }

  // --- Environments ---

  /** Lists environments. */
  listEnvironments(): ApiEnvironmentRecord[] {
    const rows = this.db.prepare("SELECT id, name, variables, is_active as isActive FROM api_environments ORDER BY name ASC").all() as (Omit<ApiEnvironmentRecord, "isActive"> & { isActive: number })[]
    return rows.map((r) => ({ ...r, isActive: !!r.isActive }))
  }

  /** Saves environment. */
  saveEnvironment(env: ApiEnvironmentRecord): ApiEnvironmentRecord[] {
    const existing = this.db.prepare("SELECT id FROM api_environments WHERE id = ?").get(env.id)
    if (existing) {
      this.db.prepare("UPDATE api_environments SET name = ?, variables = ?, is_active = ? WHERE id = ?").run(env.name, env.variables, env.isActive ? 1 : 0, env.id)
    } else {
      this.db.prepare("INSERT INTO api_environments (id, name, variables, is_active) VALUES (?, ?, ?, ?)").run(env.id, env.name, env.variables, env.isActive ? 1 : 0)
    }
    return this.listEnvironments()
  }

  /** Sets active environment. */
  setActiveEnvironment(id: string | null): ApiEnvironmentRecord[] {
    this.db.prepare("UPDATE api_environments SET is_active = 0").run()
    if (id) {
      this.db.prepare("UPDATE api_environments SET is_active = 1 WHERE id = ?").run(id)
    }
    return this.listEnvironments()
  }

  /** Deletes environment. */
  deleteEnvironment(id: string): ApiEnvironmentRecord[] {
    this.db.prepare("DELETE FROM api_environments WHERE id = ?").run(id)
    return this.listEnvironments()
  }

  // --- Cookies ---

  /** Lists cookies, dropping expired ones. */
  listCookies(): ApiCookieRecord[] {
    this.db.prepare("DELETE FROM api_cookies WHERE expires IS NOT NULL AND expires <= ?").run(Date.now())
    const rows = this.db.prepare("SELECT domain, path, name, value, expires, secure, http_only as httpOnly FROM api_cookies ORDER BY domain ASC, name ASC").all() as (Omit<ApiCookieRecord, "secure" | "httpOnly"> & { secure: number; httpOnly: number })[]
    return rows.map((row) => ({ ...row, secure: !!row.secure, httpOnly: !!row.httpOnly }))
  }

  /** Upserts cookies; an already-expired cookie deletes its stored counterpart. */
  saveCookies(cookies: ApiCookieRecord[]): void {
    this.db.transaction(() => {
      for (const cookie of cookies) {
        if (cookie.expires !== null && cookie.expires <= Date.now()) {
          this.db.prepare("DELETE FROM api_cookies WHERE domain = ? AND path = ? AND name = ?").run(cookie.domain, cookie.path, cookie.name)
          continue
        }
        this.db
          .prepare("INSERT INTO api_cookies (domain, path, name, value, expires, secure, http_only) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT(domain, path, name) DO UPDATE SET value = excluded.value, expires = excluded.expires, secure = excluded.secure, http_only = excluded.http_only")
          .run(cookie.domain, cookie.path, cookie.name, cookie.value, cookie.expires, cookie.secure ? 1 : 0, cookie.httpOnly ? 1 : 0)
      }
    })()
  }

  /** Deletes one cookie, all cookies of a domain, or everything. */
  deleteCookies(filter?: { domain: string; path?: string; name?: string }): ApiCookieRecord[] {
    if (!filter) this.db.prepare("DELETE FROM api_cookies").run()
    else if (filter.name !== undefined && filter.path !== undefined) this.db.prepare("DELETE FROM api_cookies WHERE domain = ? AND path = ? AND name = ?").run(filter.domain, filter.path, filter.name)
    else this.db.prepare("DELETE FROM api_cookies WHERE domain = ?").run(filter.domain)
    return this.listCookies()
  }

  /** Closes close. */
  close(): void {
    this.db.close()
  }
}
