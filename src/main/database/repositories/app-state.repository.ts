import type Database from "better-sqlite3"

export class AppStateRepository {
  constructor(private readonly database: Database.Database) {}

  /**
   * @description 获取状态。
   */
  get<T>(key: string): T | undefined {
    this.validateKey(key)
    const row = this.database.prepare(`SELECT value_json AS valueJson FROM app_state WHERE key = ?`).get(key) as
      | {
          valueJson: string
        }
      | undefined

    if (!row) {
      return undefined
    }
    return JSON.parse(row.valueJson) as T
  }

  /**
   * @description 保存状态。
   */
  set<T>(key: string, value: T): void {
    this.validateKey(key)
    if (value === undefined) {
      throw new TypeError("应用状态不能保存 undefined")
    }
    const now = new Date().toISOString()

    this.database
      .prepare(
        `INSERT INTO app_state (key,
          value_json,
          created_at,
          updated_at
        )
        VALUES (?, ?, ?, ?)
        ON CONFLICT(key)
        DO UPDATE SET
          value_json =
            excluded.value_json,
          updated_at =
            excluded.updated_at
        `
      )
      .run(key, JSON.stringify(value), now, now)
  }

  /**
   * @description 删除状态。
   */
  delete(key: string): boolean {
    this.validateKey(key)
    const result = this.database
      .prepare(
        `
        DELETE FROM app_state
        WHERE key = ?
        `
      )
      .run(key)
    return result.changes > 0
  }

  private validateKey(key: string): void {
    if (typeof key !== "string" || key.trim().length === 0 || key.length > 200) {
      throw new TypeError("状态 key 必须是长度为 1 到 200 的字符串")
    }
  }
}
