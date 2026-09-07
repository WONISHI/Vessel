import type Database from "better-sqlite3"

export interface SaveWorkspaceInput {
  name: string
  path: string
  files: Array<{
    name: string
    path: string
  }>
}

export interface WorkspaceRecord {
  id: number
  name: string
  path: string
  firstOpenedAt: string
  lastOpenedAt: string
  currentOpenedAt: string
  openCount: number
}

export class WorkspaceRepository {
  constructor(private readonly database: Database.Database) {}

  /**
   * 根据路径查询工作区。
   */
  findWorkspaceByPath(path: string): WorkspaceRecord | undefined {
    return this.database
      .prepare(
        `
        SELECT
          id,
          name,
          path,
          first_opened_at AS firstOpenedAt,
          last_opened_at AS lastOpenedAt,
          current_opened_at AS currentOpenedAt,
          open_count AS openCount
        FROM workspaces
        WHERE path = ?
        `
      )
      .get(path) as WorkspaceRecord | undefined
  }

  /**
   * 保存或更新工作区。
   */
  saveWorkspace(input: SaveWorkspaceInput): WorkspaceRecord {
    const now = new Date().toISOString()

    const save = this.database.transaction(() => {
      this.database
        .prepare(
          `
              INSERT INTO workspaces (
                name,
                path,
                first_opened_at,
                last_opened_at,
                current_opened_at,
                open_count
              )
              VALUES (?, ?, ?, ?, ?, 1)
              ON CONFLICT(path)
              DO UPDATE SET
                name = excluded.name,
                last_opened_at =
                  excluded.last_opened_at,
                current_opened_at =
                  excluded.current_opened_at,
                open_count =
                  workspaces.open_count + 1
              `
        )
        .run(input.name, input.path, now, now, now)

      const workspace = this.findWorkspaceByPath(input.path)

      if (!workspace) {
        throw new Error("保存工作区失败")
      }

      this.database
        .prepare(
          `
              DELETE FROM workspace_files
              WHERE workspace_id = ?
              `
        )
        .run(workspace.id)

      const insertFile = this.database.prepare(
        `
              INSERT INTO workspace_files (
                workspace_id,
                name,
                path,
                created_at
              )
              VALUES (?, ?, ?, ?)
              `
      )

      for (const file of input.files) {
        insertFile.run(workspace.id, file.name, file.path, now)
      }

      return workspace
    })

    return save()
  }

  /**
   * 获取最近打开的工作区。
   */
  getRecentWorkspaceList(limit = 20): WorkspaceRecord[] {
    const safeLimit = Math.min(Math.max(Math.trunc(limit), 1), 100)

    return this.database
      .prepare(
        `
        SELECT
          id,
          name,
          path,
          first_opened_at AS firstOpenedAt,
          last_opened_at AS lastOpenedAt,
          current_opened_at AS currentOpenedAt,
          open_count AS openCount
        FROM workspaces
        ORDER BY last_opened_at DESC
        LIMIT ?
        `
      )
      .all(safeLimit) as WorkspaceRecord[]
  }

  /**
   * 记录工作区打开历史。
   */
  recordWorkspaceOpened(workspaceId: number, deviceId?: string): void {
    this.database
      .prepare(
        `
        INSERT INTO workspace_open_records (
          workspace_id,
          device_id,
          opened_at
        )
        VALUES (?, ?, ?)
        `
      )
      .run(workspaceId, deviceId ?? null, new Date().toISOString())
  }
}
