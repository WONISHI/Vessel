import { seal, type Sealed } from './crypto'

export type VaultDocument = { version: 1; auto?: boolean; salt: string; wrapped: string; records: { id: string; data: Sealed }[]; never: Sealed; catalog?: string }
export const VAULT_AAD = 'vessel-vault-v1'
export const MAX_VAULT_BYTES = 16 * 1024 * 1024

export function validateVaultDocument(value: unknown): VaultDocument {
  const doc = value as VaultDocument
  if (!doc || doc.version !== 1 || !Array.isArray(doc.records) || doc.records.length > 10000 ||
    typeof doc.salt !== 'string' || Buffer.from(doc.salt, 'base64').length !== 16 || typeof doc.wrapped !== 'string' || !doc.never ||
    doc.records.some(record => !record || typeof record.id !== 'string' || !record.data) || new Set(doc.records.map(record => record.id)).size !== doc.records.length) throw new Error('保险库格式无效')
  if (Buffer.byteLength(JSON.stringify(doc)) > MAX_VAULT_BYTES) throw new Error('保险库数据过大')
  return doc
}

export function emptyVault(key: Buffer, salt: string, wrapped: string): VaultDocument {
  return { version: 1, auto: true, salt, wrapped, records: [], never: seal(key, '[]', `${VAULT_AAD}:never`) }
}
