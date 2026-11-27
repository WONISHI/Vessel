import { expect, it } from 'vitest'
import { randomBytes } from 'node:crypto'
import { salt, seal, unseal } from '@main/vault/crypto'
import { emptyVault, VAULT_AAD } from '@main/vault/document'
import { sealLoginDocument, unsealLoginDocument, unwrapLoginKey, validateEnvelope, wrapLoginKey } from '@main/vault/login-crypto'

it('recovers using the original login password alone, binds the account and rejects tampering without an OS key', async () => {
  const key = randomBytes(32), password = 'original-login-password', account = 'account-one'
  const doc = emptyVault(key, salt(), 'os-wrapped-key-must-stay-local')
  doc.catalog = 'os-only-index'
  doc.records.push({ id: 'entry-one', data: seal(key, JSON.stringify({ username: 'private-user', password: 'website-secret' }), `${VAULT_AAD}:entry-one`) })
  const envelope = sealLoginDocument(await wrapLoginKey(password, account, key), key, account, doc)
  const dump = JSON.stringify(envelope)
  for (const secret of [password, 'private-user', 'website-secret', doc.wrapped, doc.catalog, key.toString('base64')]) expect(dump).not.toContain(secret)
  const recovered = await unwrapLoginKey(password, account, JSON.parse(dump))
  expect(recovered).toEqual(key)
  const restored = unsealLoginDocument(envelope, recovered, account, 'new-device-os-wrap')
  expect(restored.wrapped).toBe('new-device-os-wrap')
  expect(unseal(recovered, restored.records[0].data, `${VAULT_AAD}:entry-one`)).toContain('website-secret')
  await expect(unwrapLoginKey('reset-password-is-not-original', account, envelope)).rejects.toThrow('原登录密码')
  await expect(unwrapLoginKey(password, 'different-account', envelope)).rejects.toThrow()
  expect(() => unsealLoginDocument(envelope, key, 'different-account', 'wrap')).toThrow()
  expect(() => unsealLoginDocument({ ...envelope, payload: { ...envelope.payload, tag: randomBytes(16).toString('base64') } }, key, account, 'wrap')).toThrow()
  expect(() => validateEnvelope({ ...envelope, kdf: { ...envelope.kdf, memory: 2 ** 30 } })).toThrow('格式')
  recovered.fill(0); key.fill(0)
}, 60000)
