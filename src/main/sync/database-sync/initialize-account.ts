import type { Client } from 'pg'
import { remoteTableName, type SyncTable } from './local-data'

const quote = (value: string) => `"${value.replaceAll('"', '""')}"`

/** An empty account is independent of other users in the same PostgreSQL database. */
export async function accountNeedsInitialization(client: Client, accountId: string): Promise<boolean> {
  const marker = await client.query('SELECT 1 FROM vessel_sync.account_initialization WHERE account_id=$1', [accountId])
  if (marker.rows.length) return false
  const catalog = await client.query('SELECT 1 FROM vessel_sync.table_catalog WHERE account_id=$1 AND row_count>0 LIMIT 1', [accountId])
  if (catalog.rows.length) return false
  const tables = await client.query("SELECT table_name FROM information_schema.columns WHERE table_schema='vessel_data' AND column_name='account_id'")
  const checks = tables.rows.filter(({ table_name: name }) => name !== 'sequences')
    .map(({ table_name: name }) => `EXISTS (SELECT 1 FROM vessel_data.${quote(name)} WHERE account_id=$1)`)
  if (!checks.length) return true
  const data = await client.query(`SELECT 1 WHERE ${checks.join(' OR ')}`, [accountId])
  return data.rows.length === 0
}

/** Seed the actual live data tables, atomically, only after explicit consent. */
export async function initializeAccount(client: Client, accountId: string, tables: SyncTable[], importLocal: boolean, sequences: Record<string, unknown[]> = {}) {
  return writeAccount(client, accountId, tables, importLocal, sequences, false)
}

/** Explicitly replace this account's corresponding live tables with the local snapshot. */
export async function synchronizeLocalAccount(client: Client, accountId: string, tables: SyncTable[], sequences: Record<string, unknown[]>) {
  return writeAccount(client, accountId, tables, true, sequences, true)
}

async function writeAccount(client: Client, accountId: string, tables: SyncTable[], importLocal: boolean, sequences: Record<string, unknown[]>, replace: boolean) {
  await client.query('BEGIN')
  try {
    await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [accountId])
    if (!replace && !await accountNeedsInitialization(client, accountId)) throw new Error('该账号已有远程数据，请重新登录；未覆盖远程数据')
    await client.query('SELECT pg_advisory_xact_lock(736514831)')
    await client.query('CREATE SCHEMA IF NOT EXISTS vessel_data')
    await client.query('CREATE TABLE IF NOT EXISTS vessel_data.sequences (account_id UUID NOT NULL REFERENCES vessel_sync.accounts(id), database_name TEXT NOT NULL, data JSONB NOT NULL, PRIMARY KEY(account_id,database_name))')
    if (replace && tables.length) {
      await client.query(tables.map(table => `CREATE TABLE IF NOT EXISTS vessel_data.${quote(remoteTableName(table.database, table.name))} (account_id UUID NOT NULL REFERENCES vessel_sync.accounts(id), row_key BIGINT NOT NULL, data JSONB NOT NULL, PRIMARY KEY(account_id,row_key))`).join('; '))
      await client.query(`WITH ${tables.map((table, index) => `cleared_${index} AS (DELETE FROM vessel_data.${quote(remoteTableName(table.database, table.name))} WHERE account_id=$1)`).join(', ')} SELECT 1`, [accountId])
      await client.query('DELETE FROM vessel_data.sequences WHERE account_id=$1 AND database_name=ANY($2::text[])', [accountId, [...new Set(tables.map(table => table.database))]])
    }
    for (const table of tables) {
      const name = quote(remoteTableName(table.database, table.name))
      if (!replace) await client.query(`CREATE TABLE IF NOT EXISTS vessel_data.${name} (account_id UUID NOT NULL REFERENCES vessel_sync.accounts(id), row_key BIGINT NOT NULL, data JSONB NOT NULL, PRIMARY KEY(account_id,row_key))`)
      if (!importLocal) continue
      for (let offset = 0; offset < table.rows.length; offset += 200) {
        const rows = table.rows.slice(offset, offset + 200)
        await client.query(`INSERT INTO vessel_data.${name}(account_id,row_key,data) SELECT $1,x.key::bigint,x.value::jsonb FROM jsonb_to_recordset($2::jsonb) AS x(key text,value text)`, [accountId, JSON.stringify(rows)])
      }
    }
    if (importLocal) for (const [name, rows] of Object.entries(sequences)) {
      await client.query('INSERT INTO vessel_data.sequences(account_id,database_name,data) VALUES($1,$2,$3::jsonb)', [accountId, name, JSON.stringify(rows)])
    }
    await client.query('INSERT INTO vessel_sync.account_initialization(account_id) VALUES($1)' + (replace ? ' ON CONFLICT(account_id) DO NOTHING' : ''), [accountId])
    await client.query('COMMIT')
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {})
    throw error
  }
}
