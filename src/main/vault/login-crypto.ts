import { randomBytes } from 'node:crypto'
import { argon2id } from 'hash-wasm'
import { seal, unseal, type Sealed } from './crypto'
import { MAX_VAULT_BYTES, validateVaultDocument, type VaultDocument } from './document'

// Fixed, versioned parameters: untrusted database rows cannot choose an excessive KDF cost.
const KDF = { algorithm: 'argon2id', memory: 65536, iterations: 3, parallelism: 1 } as const
export type LoginVaultEnvelope = { version: 2; kdf: typeof KDF; salt: string; wrappedKey: Sealed; payload: Sealed }
const aad = (account: string, purpose: string) => `vessel-login-vault-v2:${account}:${purpose}`

export function validateEnvelope(value: unknown): LoginVaultEnvelope {
  const item = value as LoginVaultEnvelope
  const sealed = (data: Sealed) => data && typeof data.nonce === 'string' && Buffer.from(data.nonce, 'base64').length === 12 &&
    typeof data.tag === 'string' && Buffer.from(data.tag, 'base64').length === 16 && typeof data.ciphertext === 'string'
  if (!item || item.version !== 2 || item.kdf?.algorithm !== KDF.algorithm || item.kdf.memory !== KDF.memory ||
    item.kdf.iterations !== KDF.iterations || item.kdf.parallelism !== KDF.parallelism || typeof item.salt !== 'string' ||
    Buffer.from(item.salt, 'base64').length !== 32 || !sealed(item.wrappedKey) || !sealed(item.payload) ||
    Buffer.byteLength(JSON.stringify(item)) > MAX_VAULT_BYTES * 2) throw new Error('远程保险库格式无效，未覆盖原数据')
  return item
}
async function deriveLoginKey(password: string, salt: string, account: string) {
  if (typeof password !== 'string' || password.length < 8 || password.length > 256) throw new Error('登录密码格式无效')
  // Purpose separation keeps the account authentication verifier independent of this key.
  const hash = await argon2id({ password, salt: Buffer.concat([Buffer.from(salt, 'base64'), Buffer.from(aad(account, 'kdf'))]),
    memorySize: KDF.memory, iterations: KDF.iterations, parallelism: KDF.parallelism, hashLength: 32, outputType: 'binary' })
  try { return Buffer.from(hash) }
  finally { hash.fill(0) }
}
export async function wrapLoginKey(password: string, account: string, key: Buffer) {
  const salt = randomBytes(32).toString('base64'), derived = await deriveLoginKey(password, salt, account)
  try { return { version: 2 as const, kdf: KDF, salt, wrappedKey: seal(derived, key.toString('base64'), aad(account, 'key')) } }
  finally { derived.fill(0) }
}
export async function unwrapLoginKey(password: string, account: string, value: LoginVaultEnvelope) {
  const item = validateEnvelope(value), derived = await deriveLoginKey(password, item.salt, account)
  try {
    const key = Buffer.from(unseal(derived, item.wrappedKey, aad(account, 'key')), 'base64')
    if (key.length !== 32) { key.fill(0); throw new Error() }
    return key
  } catch { throw new Error('原登录密码无法解锁保险库，原数据未被覆盖') }
  finally { derived.fill(0) }
}
export function sealLoginDocument(header: Omit<LoginVaultEnvelope, 'payload'>, key: Buffer, account: string, doc: VaultDocument): LoginVaultEnvelope {
  validateVaultDocument(doc)
  // OS-wrapped keys and the OS-only account index must NEVER enter the remote database.
  const payload = { version: doc.version, salt: doc.salt, records: doc.records, never: doc.never }
  return { ...header, payload: seal(key, JSON.stringify(payload), aad(account, 'payload')) }
}
export function unsealLoginDocument(envelope: LoginVaultEnvelope, key: Buffer, account: string, osWrapped: string): VaultDocument {
  const payload = JSON.parse(unseal(key, validateEnvelope(envelope).payload, aad(account, 'payload')))
  return validateVaultDocument({ version: payload.version, salt: payload.salt, records: payload.records, never: payload.never, auto: true, wrapped: osWrapped })
}
