import { expect, it } from 'vitest'
import { argon2idAsync } from '@noble/hashes/argon2.js'
import { hashAccountPassword, verifyAccountPassword } from '@main/sync/database-sync/account-password'
import { unwrapLoginKey, wrapLoginKey } from '@main/vault/login-crypto'
import { seal, unseal } from '@main/vault/crypto'

const password = '原登录密码-🔑-fixture', options = { m: 65536, t: 3, p: 1 }

it('produces the existing account verifier byte-for-byte and accepts an original verifier', async () => {
  const salt = 'a1'.repeat(16)
  const original = Buffer.from(await argon2idAsync(password, Buffer.concat([Buffer.from('vessel-account-verifier-v1:'), Buffer.from(salt, 'hex')]), { ...options, dkLen: 64 }))
  try {
    const stored = 'argon2id-v1:' + original.toString('hex')
    expect(await hashAccountPassword(password, salt)).toBe(stored)
    expect(await verifyAccountPassword(password, salt, stored)).toEqual({ valid: true, legacy: false })
  } finally { original.fill(0) }
}, 60000)

it('unlocks an original encrypted vault and creates keys compatible with the original implementation', async () => {
  const account = 'account-fixture', key = Buffer.alloc(32, 7), salt = Buffer.alloc(32, 3).toString('base64')
  const aad = `vessel-login-vault-v2:${account}:key`
  const derive = async (value: string) => Buffer.from(await argon2idAsync(password, Buffer.concat([Buffer.from(value, 'base64'), Buffer.from(`vessel-login-vault-v2:${account}:kdf`)]), { ...options, dkLen: 32 }))
  const original = await derive(salt)
  try {
    const envelope = { version: 2 as const, kdf: { algorithm: 'argon2id' as const, memory: 65536, iterations: 3, parallelism: 1 }, salt, wrappedKey: seal(original, key.toString('base64'), aad), payload: seal(key, '{}', 'fixture-payload') }
    const recovered = await unwrapLoginKey(password, account, envelope)
    try { expect(recovered).toEqual(key) } finally { recovered.fill(0) }
    const next = await wrapLoginKey(password, account, key)
    const compatible = await derive(next.salt)
    try { expect(unseal(compatible, next.wrappedKey, aad)).toBe(key.toString('base64')) }
    finally { compatible.fill(0) }
  } finally { original.fill(0); key.fill(0) }
}, 60000)
