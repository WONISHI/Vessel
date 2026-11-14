import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto"
import { argon2idAsync } from "@noble/hashes/argon2.js"

export type Sealed = { nonce: string; ciphertext: string; tag: string }
export const salt = () => randomBytes(16).toString("base64")
export async function derive(password: string, value: string) {
  if (typeof password !== "string" || password.length < 12 || password.length > 1024) throw new Error("密码需要 12 至 1024 个字符")
  return Buffer.from(await argon2idAsync(password, Buffer.from(value, "base64"), { m: 65536, t: 3, p: 1, dkLen: 32 }))
}
export function seal(key: Buffer, text: string, aad: string): Sealed {
  const nonce = randomBytes(12), cipher = createCipheriv("aes-256-gcm", key, nonce)
  cipher.setAAD(Buffer.from(aad))
  return { nonce: nonce.toString("base64"), ciphertext: Buffer.concat([cipher.update(text, "utf8"), cipher.final()]).toString("base64"), tag: cipher.getAuthTag().toString("base64") }
}
export function unseal(key: Buffer, data: Sealed, aad: string) {
  const decipher = createDecipheriv("aes-256-gcm", key, Buffer.from(data.nonce, "base64"))
  decipher.setAAD(Buffer.from(aad)); decipher.setAuthTag(Buffer.from(data.tag, "base64"))
  return Buffer.concat([decipher.update(Buffer.from(data.ciphertext, "base64")), decipher.final()]).toString("utf8")
}
export function credentialOrigin(url: string) {
  const value = new URL(url)
  if (value.protocol !== "https:") throw new Error("第一版仅支持 HTTPS 网站")
  return value.origin
}
