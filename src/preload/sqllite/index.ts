import { ipcMain } from "electron"

import type { EnhancedDatabase } from "../../main/database/index"
import { DATABASE_CHANNELS, type DatabaseTableDataRequest, type DatabaseTableRequest } from "../../main/database/type"

export class DatabaseIpcModule {
  constructor(private readonly database: EnhancedDatabase) {}

  /**
   * 注册数据库 IPC。
   */
  register(): void {
    /**
     * 防止开发环境热更新时重复注册。
     */
    this.unregister()

    ipcMain.handle(DATABASE_CHANNELS.getTables, () => {
      return this.database.getTables()
    })

    ipcMain.handle(DATABASE_CHANNELS.getTableData, (_event, request: DatabaseTableDataRequest) => {
      this.validateTableName(request?.tableName)

      const page = request.page ?? 1
      const pageSize = request.pageSize ?? 50

      return {
        tableName: request.tableName,
        page,
        pageSize,
        total: this.database.getTableRowCount(request.tableName),
        records: this.database.getTableData(request.tableName, page, pageSize)
      }
    })

    ipcMain.handle(DATABASE_CHANNELS.getTableSchema, (_event, request: DatabaseTableRequest) => {
      this.validateTableName(request?.tableName)

      return this.database.getTableSchema(request.tableName)
    })

    ipcMain.handle(DATABASE_CHANNELS.getTableRowCount, (_event, request: DatabaseTableRequest) => {
      this.validateTableName(request?.tableName)

      return this.database.getTableRowCount(request.tableName)
    })

    ipcMain.handle(DATABASE_CHANNELS.getAllTablesData, (_event, page = 1, pageSize = 50) => {
      return this.database.getAllTablesData(page, pageSize)
    })
  }

  /**
   * 注销数据库 IPC。
   */
  unregister(): void {
    Object.values(DATABASE_CHANNELS).forEach((channel) => {
      ipcMain.removeHandler(channel)
    })
  }

  /**
   * 校验 IPC 接收到的表名。
   */
  private validateTableName(tableName: unknown): asserts tableName is string {
    if (typeof tableName !== "string" || tableName.trim().length === 0) {
      throw new TypeError("数据库表名不能为空")
    }
  }
}
