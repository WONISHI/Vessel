export type DatabaseSyncConfig = {
  type: 'postgresql'
  host: string
  port: number
  database: string
  username: string
  password: string
  sslmode: 'require' | 'verify-full' | 'disable'
  connectTimeout: number
}
export type DatabaseSyncResult = { at: string; databases: number; tables: number; rows: number }
export type DatabaseDomain = 'system' | 'user'
export type DatabaseSyncStatus = {
  initializationRequired?: boolean
  systemAvailable?: boolean
  userConfigured?: boolean
  domain?: DatabaseDomain
  source?: 'local' | 'remote'
  configured: boolean
  connected: boolean
  config?: Omit<DatabaseSyncConfig, 'password'>
  user?: { id: string; name: string }
  lastSync?: DatabaseSyncResult
}
export interface DatabaseSyncAPI {
  databaseSync: {
    status(): Promise<DatabaseSyncStatus>
    ready(): Promise<void>
    onSourceChanged(callback: (destination?: string, synchronized?: boolean) => void): () => void
    connect(config?: DatabaseSyncConfig, domain?: DatabaseDomain): Promise<DatabaseSyncStatus>
    authenticate(mode: 'login' | 'register', name: string, password: string): Promise<DatabaseSyncStatus>
    initialize(importLocal: boolean): Promise<DatabaseSyncStatus>
    logout(): Promise<DatabaseSyncStatus>
    upload(): Promise<DatabaseSyncResult>
    syncLocal(): Promise<DatabaseSyncResult>
    disconnect(): Promise<DatabaseSyncStatus>
    deleteData(scope: DatabaseDeleteScope, confirmation: string): Promise<{ restarting: boolean; remoteDeleted: boolean }>
  }
}

export type DatabaseDeleteScope = 'local' | 'both' | 'remote'
export const DATABASE_DELETE_CONFIRMATION: Record<DatabaseDeleteScope, string> = {
  local: '确认删除本地数据库',
  both: '确认删除本地和远程数据库',
  remote: '确认删除远程数据库'
}
export function validateDatabaseDeletion(scope: unknown, confirmation: unknown): DatabaseDeleteScope {
  if (scope !== 'local' && scope !== 'both' && scope !== 'remote') throw new Error('删除范围无效')
  if (confirmation !== DATABASE_DELETE_CONFIRMATION[scope]) throw new Error('确认文字不匹配，未删除任何数据')
  return scope
}
