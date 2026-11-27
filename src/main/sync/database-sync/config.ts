import type { DatabaseSyncConfig } from '@vessel/type/database-sync'
import type { ClientConfig } from 'pg'

export function validateDatabaseSyncConfig(value: unknown): DatabaseSyncConfig {
  if (!value || typeof value !== 'object') throw new Error('数据库配置无效')
  const c = value as DatabaseSyncConfig
  if (c.type !== 'postgresql') throw new Error('目前支持 PostgreSQL 数据库')
  for (const key of ['host', 'database', 'username'] as const) {
    if (typeof c[key] !== 'string' || !c[key].trim() || c[key].length > 255) throw new Error('请填写主机、数据库名和用户名')
  }
  if (/[/\s?#@]/.test(c.host)) throw new Error('主机地址只能填写域名或 IP')
  if (typeof c.password !== 'string' || c.password.length > 4096) throw new Error('数据库密码无效')
  if (!Number.isInteger(c.port) || c.port < 1 || c.port > 65535) throw new Error('端口应为 1–65535')
  if (!Number.isInteger(c.connectTimeout) || c.connectTimeout < 1 || c.connectTimeout > 120) throw new Error('连接超时应为 1–120 秒')
  if (!['require', 'verify-full', 'disable'].includes(c.sslmode)) throw new Error('SSL 模式无效')
  return { type: 'postgresql', host: c.host.trim(), database: c.database.trim(), username: c.username.trim(), password: c.password, port: c.port, sslmode: c.sslmode, connectTimeout: c.connectTimeout }
}
export function postgresOptions(config: DatabaseSyncConfig): ClientConfig {
  return { host: config.host, port: config.port, database: config.database, user: config.username, password: config.password,
    enableChannelBinding: true,
    ssl: config.sslmode === 'disable' ? false : { rejectUnauthorized: config.sslmode === 'verify-full' },
    connectionTimeoutMillis: config.connectTimeout * 1000, statement_timeout: 60000, query_timeout: 65000, application_name: 'Vessel database sync' }
}
