import type { DatabaseSyncConfig } from '@vessel/type/database-sync'
export const emptyDatabaseSyncConfig: DatabaseSyncConfig = { type: 'postgresql', host: '', port: 5432, database: '', username: '', password: '', sslmode: 'require', connectTimeout: 30 }
export function parseDatabaseConnection(text: string): DatabaseSyncConfig {
  let source = text.trim().replace(/^DATABASE_URL\s*=\s*/, '')
  if ((source.startsWith('"') && source.endsWith('"')) || (source.startsWith("'") && source.endsWith("'"))) source = source.slice(1, -1)
  if (source.startsWith('{')) {
    const value = JSON.parse(source)
    if (typeof value.connectionString === 'string') return parseDatabaseConnection(value.connectionString)
    if (typeof value.url === 'string') return parseDatabaseConnection(value.url)
    return { ...emptyDatabaseSyncConfig, ...value, username: value.username ?? value.user ?? '', connectTimeout: Number(value.connectTimeout ?? value.connect_timeout ?? 30), port: Number(value.port ?? 5432) }
  }
  let url: URL
  try { url = new URL(source) } catch { throw new Error('请粘贴 PostgreSQL 连接字符串或 JSON 配置') }
  if (!['postgres:', 'postgresql:'].includes(url.protocol)) throw new Error('目前仅支持 PostgreSQL 连接字符串')
  for (const key of url.searchParams.keys()) if (!['sslmode', 'connect_timeout'].includes(key)) throw new Error(`暂不支持连接参数 ${key}，请使用表单配置`)
  const mode = url.searchParams.get('sslmode') ?? 'require'
  if (!['require', 'verify-full', 'disable'].includes(mode)) throw new Error('SSL 模式支持 require、verify-full 或 disable')
  return { type: 'postgresql', host: url.hostname.replace(/^\[|\]$/g, ''), port: Number(url.port || 5432), username: decodeURIComponent(url.username), password: decodeURIComponent(url.password), database: decodeURIComponent(url.pathname.slice(1)), sslmode: mode as DatabaseSyncConfig['sslmode'], connectTimeout: Number(url.searchParams.get('connect_timeout') || 30) }
}
