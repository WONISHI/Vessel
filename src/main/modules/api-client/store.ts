import Database from "better-sqlite3"

export interface ApiCollectionRecord {
  id: string
  name: string
  parentId: string | null
  createdAt: number
}

export interface ApiRequestRecord {
  id: string
  collectionId: string | null
  name: string
  method: string
  url: string
  headers: string // JSON: { key, value, enabled, description }[]
  params: string // JSON: { key, value, enabled, description }[]
  bodyType: "none" | "form-data" | "x-www-form-urlencoded" | "raw" | "binary"
  bodyContent: string // text, JSON, or form fields JSON
  rawType?: "json" | "text" | "html" | "xml" | "javascript"
  authType: "none" | "bearer" | "basic" | "apiKey"
  authConfig: string // JSON
  tests: string // test assertion code / script
  updatedAt: number
}

export interface ApiHistoryRecord {
  id: number
  method: string
  url: string
  status: number
  statusText: string
  durationMs: number
  sizeBytes: number
  requestData: string // JSON snapshot of request
  responsePreview?: string
  createdAt: number
}

export interface ApiEnvironmentRecord {
  id: string
  name: string
  variables: string // JSON: { key, value, enabled }[]
  isActive: boolean
}

export class ApiClientStore {
  private db: Database.Database

  constructor(dbPath: string) {
    this.db = new Database(dbPath)
    this.db.pragma("journal_mode = WAL")
    this.initTables()
  }

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
    `)

    // 初始化默认环境（如果为空）
    const count = (this.db.prepare("SELECT COUNT(*) as c FROM api_environments").get() as { c: number }).c
    if (count === 0) {
      this.saveEnvironment({
        id: "env-dev",
        name: "Dev 环境",
        variables: JSON.stringify([
          { key: "baseUrl", value: "https://jsonplaceholder.typicode.com", enabled: true }
        ]),
        isActive: true
      })
      this.saveEnvironment({
        id: "env-prod",
        name: "Prod 生产环境",
        variables: JSON.stringify([
          { key: "baseUrl", value: "https://api.github.com", enabled: true }
        ]),
        isActive: false
      })
    }
  }

  // --- Collections ---
  listCollections(): ApiCollectionRecord[] {
    return (this.db.prepare("SELECT id, name, parent_id as parentId, created_at as createdAt FROM api_collections ORDER BY created_at ASC").all() as ApiCollectionRecord[])
  }

  saveCollection(record: { id: string; name: string; parentId?: string | null }): ApiCollectionRecord[] {
    const existing = this.db.prepare("SELECT id FROM api_collections WHERE id = ?").get(record.id)
    if (existing) {
      this.db.prepare("UPDATE api_collections SET name = ?, parent_id = ? WHERE id = ?").run(
        record.name,
        record.parentId || null,
        record.id
      )
    } else {
      this.db.prepare("INSERT INTO api_collections (id, name, parent_id, created_at) VALUES (?, ?, ?, ?)").run(
        record.id,
        record.name,
        record.parentId || null,
        Date.now()
      )
    }
    return this.listCollections()
  }

  deleteCollection(id: string): ApiCollectionRecord[] {
    this.db.prepare("DELETE FROM api_requests WHERE collection_id = ?").run(id)
    this.db.prepare("DELETE FROM api_collections WHERE id = ? OR parent_id = ?").run(id, id)
    return this.listCollections()
  }

  // --- Requests ---
  listRequests(collectionId?: string): ApiRequestRecord[] {
    if (collectionId) {
      return (this.db.prepare("SELECT id, collection_id as collectionId, name, method, url, headers, params, body_type as bodyType, body_content as bodyContent, auth_type as authType, auth_config as authConfig, tests, updated_at as updatedAt FROM api_requests WHERE collection_id = ? ORDER BY updated_at DESC").all(collectionId) as ApiRequestRecord[])
    }
    return (this.db.prepare("SELECT id, collection_id as collectionId, name, method, url, headers, params, body_type as bodyType, body_content as bodyContent, auth_type as authType, auth_config as authConfig, tests, updated_at as updatedAt FROM api_requests ORDER BY updated_at DESC").all() as ApiRequestRecord[])
  }

  saveRequest(record: ApiRequestRecord): ApiRequestRecord {
    const existing = this.db.prepare("SELECT id FROM api_requests WHERE id = ?").get(record.id)
    if (existing) {
      this.db.prepare(`
        UPDATE api_requests SET
          collection_id = ?, name = ?, method = ?, url = ?, headers = ?, params = ?,
          body_type = ?, body_content = ?, auth_type = ?, auth_config = ?, tests = ?, updated_at = ?
        WHERE id = ?
      `).run(
        record.collectionId,
        record.name,
        record.method,
        record.url,
        record.headers,
        record.params,
        record.bodyType,
        record.bodyContent,
        record.authType,
        record.authConfig,
        record.tests,
        Date.now(),
        record.id
      )
    } else {
      this.db.prepare(`
        INSERT INTO api_requests (
          id, collection_id, name, method, url, headers, params, body_type, body_content, auth_type, auth_config, tests, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        record.id,
        record.collectionId,
        record.name,
        record.method,
        record.url,
        record.headers,
        record.params,
        record.bodyType,
        record.bodyContent,
        record.authType,
        record.authConfig,
        record.tests,
        Date.now()
      )
    }
    return record
  }

  deleteRequest(id: string): void {
    this.db.prepare("DELETE FROM api_requests WHERE id = ?").run(id)
  }

  // --- History ---
  listHistory(limit = 100): ApiHistoryRecord[] {
    return (this.db.prepare(`
      SELECT
        id, method, url, status, status_text as statusText, duration_ms as durationMs,
        size_bytes as sizeBytes, request_data as requestData, response_preview as responsePreview, created_at as createdAt
      FROM api_history
      ORDER BY created_at DESC
      LIMIT ?
    `).all(limit) as ApiHistoryRecord[])
  }

  addHistory(entry: Omit<ApiHistoryRecord, "id">): ApiHistoryRecord {
    const res = this.db.prepare(`
      INSERT INTO api_history (method, url, status, status_text, duration_ms, size_bytes, request_data, response_preview, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      entry.method,
      entry.url,
      entry.status,
      entry.statusText,
      entry.durationMs,
      entry.sizeBytes,
      entry.requestData,
      entry.responsePreview || "",
      entry.createdAt || Date.now()
    )
    return { ...entry, id: Number(res.lastInsertRowid) }
  }

  clearHistory(): void {
    this.db.prepare("DELETE FROM api_history").run()
  }

  deleteHistory(id: number): void {
    this.db.prepare("DELETE FROM api_history WHERE id = ?").run(id)
  }

  // --- Environments ---
  listEnvironments(): ApiEnvironmentRecord[] {
    const rows = this.db.prepare("SELECT id, name, variables, is_active as isActive FROM api_environments ORDER BY name ASC").all() as (Omit<ApiEnvironmentRecord, "isActive"> & { isActive: number })[]
    return rows.map(r => ({ ...r, isActive: !!r.isActive }))
  }

  saveEnvironment(env: ApiEnvironmentRecord): ApiEnvironmentRecord[] {
    const existing = this.db.prepare("SELECT id FROM api_environments WHERE id = ?").get(env.id)
    if (existing) {
      this.db.prepare("UPDATE api_environments SET name = ?, variables = ?, is_active = ? WHERE id = ?").run(
        env.name,
        env.variables,
        env.isActive ? 1 : 0,
        env.id
      )
    } else {
      this.db.prepare("INSERT INTO api_environments (id, name, variables, is_active) VALUES (?, ?, ?, ?)").run(
        env.id,
        env.name,
        env.variables,
        env.isActive ? 1 : 0
      )
    }
    return this.listEnvironments()
  }

  setActiveEnvironment(id: string | null): ApiEnvironmentRecord[] {
    this.db.prepare("UPDATE api_environments SET is_active = 0").run()
    if (id) {
      this.db.prepare("UPDATE api_environments SET is_active = 1 WHERE id = ?").run(id)
    }
    return this.listEnvironments()
  }

  deleteEnvironment(id: string): ApiEnvironmentRecord[] {
    this.db.prepare("DELETE FROM api_environments WHERE id = ?").run(id)
    return this.listEnvironments()
  }

  close(): void {
    this.db.close()
  }
}
