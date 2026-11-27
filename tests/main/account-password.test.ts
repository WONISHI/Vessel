import { expect, it } from 'vitest'
import { scryptSync } from 'node:crypto'
import { hashAccountPassword, verifyAccountPassword } from '@main/sync/database-sync/account-password'

it('uses a distinct Argon2id verifier while accepting legacy scrypt passwords for upgrade', async () => {
  const salt = 'a1'.repeat(16), password = 'original-account-password'
  const hash = await hashAccountPassword(password, salt)
  expect(hash).toMatch(/^argon2id-v1:[a-f0-9]{128}$/)
  expect(await verifyAccountPassword(password, salt, hash)).toEqual({ valid: true, legacy: false })
  expect(await verifyAccountPassword('wrong-password', salt, hash)).toEqual({ valid: false, legacy: false })
  expect(await verifyAccountPassword(password, salt, scryptSync(password, salt, 64).toString('hex'))).toEqual({ valid: true, legacy: true })
  await expect(verifyAccountPassword(password, '', hash)).rejects.toThrow('无效')
}, 60000)
