import type { DatabaseSyncConfig } from '@vessel/type/database-sync'
import { existsSync, readFileSync } from 'node:fs'
import { validateDatabaseSyncConfig } from '../sync/database-sync/config'

/** Runtime-only configuration. Never embed database owner credentials in a distribution. */
export function loadSystemDomainDatabase(file: string, connection = process.env.VESSEL_SYSTEM_DATABASE_URL): DatabaseSyncConfig | undefined {
  const value = connection?.trim() || (existsSync(file) ? readFileSync(file, 'utf8').trim() : '')
  if (!value) return undefined
  try {
    const url = new URL(value)
    if (!['postgresql:', 'postgres:'].includes(url.protocol)) throw new Error()
    if (!['require', 'verify-full'].includes(url.searchParams.get('sslmode') ?? '')) throw new Error()
    return validateDatabaseSyncConfig({
      type: 'postgresql', host: url.hostname, port: Number(url.port || 5432),
      database: decodeURIComponent(url.pathname.slice(1)), username: decodeURIComponent(url.username),
      password: decodeURIComponent(url.password), sslmode: 'verify-full', connectTimeout: 30
    })
  } catch {
    throw new Error('系统域数据库连接配置无效，请检查连接地址并启用 SSL')
  }
}
