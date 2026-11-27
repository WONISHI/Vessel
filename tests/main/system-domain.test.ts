import { afterEach, expect, it } from 'vitest'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { loadSystemDomainDatabase } from '../../src/main/database/system-domain'
import { postgresOptions } from '../../src/main/sync/database-sync/config'

const directories: string[] = []
afterEach(() => { for (const directory of directories.splice(0)) rmSync(directory, { recursive: true, force: true }) })
const connection = 'postgresql://owner:p%40ss@fixture.neon.tech/neondb?sslmode=require&channel_binding=require'

it('loads runtime credentials with verified TLS and channel binding', () => {
  const config = loadSystemDomainDatabase('/missing', connection)!
  expect(config).toMatchObject({ username: 'owner', password: 'p@ss', database: 'neondb', port: 5432, sslmode: 'verify-full' })
  expect(postgresOptions(config)).toMatchObject({ ssl: { rejectUnauthorized: true }, enableChannelBinding: true })
})

it('reads a machine-local file and allows environment configuration to override it', () => {
  const directory = mkdtempSync(join(tmpdir(), 'vessel-system-domain-')); directories.push(directory)
  const file = join(directory, 'connection')
  writeFileSync(file, connection, { mode: 0o600 })
  expect(loadSystemDomainDatabase(file, '')?.host).toBe('fixture.neon.tech')
  expect(loadSystemDomainDatabase(file, connection.replace('fixture.neon.tech', 'override.neon.tech'))?.host).toBe('override.neon.tech')
})

it('keeps an unconfigured installation local and rejects insecure or malformed URLs without exposing secrets', () => {
  expect(loadSystemDomainDatabase('/missing', '')).toBeUndefined()
  for (const value of [connection.replace('sslmode=require', 'sslmode=disable'), 'postgresql://owner:secret@host/%ZZ?sslmode=require', 'https://secret.example']) {
    expect(() => loadSystemDomainDatabase('/missing', value)).toThrow('系统域数据库连接配置无效，请检查连接地址并启用 SSL')
  }
})
