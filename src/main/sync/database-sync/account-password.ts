import { argon2id } from 'hash-wasm'
import { scrypt, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'

const legacyDerive = promisify(scrypt)
const prefix = 'argon2id-v1:'
async function derive(password: string, salt: string) {
  if (!/^[a-f0-9]{32}$/i.test(salt)) throw new Error('账号密码校验数据无效')
  const hash = await argon2id({ password, salt: Buffer.concat([Buffer.from('vessel-account-verifier-v1:'), Buffer.from(salt, 'hex')]), memorySize: 65536, iterations: 3, parallelism: 1, hashLength: 64, outputType: 'binary' })
  try { return Buffer.from(hash) }
  finally { hash.fill(0) }
}
export async function hashAccountPassword(password: string, salt: string) {
  const hash = await derive(password, salt)
  try { return prefix + hash.toString('hex') }
  finally { hash.fill(0) }
}
export async function verifyAccountPassword(password: string, salt: string, stored: string) {
  const modern = stored.startsWith(prefix), hex = modern ? stored.slice(prefix.length) : stored
  if (!/^[a-f0-9]{128}$/i.test(hex) || !/^[a-f0-9]{32}$/i.test(salt)) throw new Error('账号密码校验数据无效')
  const actual = modern ? await derive(password, salt) : await legacyDerive(password, salt, 64) as Buffer
  const expected = Buffer.from(hex, 'hex')
  try { return { valid: timingSafeEqual(actual, expected), legacy: !modern } }
  finally { actual.fill(0); expected.fill(0) }
}
