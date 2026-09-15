export const DATABASE_CHANNELS = {
  getTables: "database:getTables",
  getTableData: "database:getTableData",
  getTableSchema: "database:getTableSchema",
  getTableRowCount: "database:getTableRowCount",
  getAllTablesData: "database:getAllTablesData"
} as const

export interface DatabaseTableInfo {
  name: string
  sql: string | null
}

export interface DatabaseColumnInfo {
  cid: number
  name: string
  type: string
  notNull: number
  defaultValue: string | null
  primaryKey: number
}

export interface DatabaseTableDataRequest {
  tableName: string
  page?: number
  pageSize?: number
}

export interface DatabaseTableRequest {
  tableName: string
}

export interface DatabaseTableDataResult {
  tableName: string
  page: number
  pageSize: number
  total: number
  records: Record<string, unknown>[]
}

export interface DatabaseTableOverview {
  name: string
  sql: string | null
  total: number
  page: number
  pageSize: number
  records: Record<string, unknown>[]
}

export interface DatabaseRendererAPI {
  getTables(): Promise<DatabaseTableInfo[]>
  getTableData(request: DatabaseTableDataRequest): Promise<DatabaseTableDataResult>
  getTableSchema(request: DatabaseTableRequest): Promise<DatabaseColumnInfo[]>
  getTableRowCount(request: DatabaseTableRequest): Promise<number>
  getAllTablesData(page?: number, pageSize?: number): Promise<DatabaseTableOverview[]>
}
