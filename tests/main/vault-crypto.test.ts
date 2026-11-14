import { expect, it } from "vitest"
import { randomBytes } from "node:crypto"
import { credentialOrigin, derive, salt, seal, unseal } from "@main/vault/crypto"

it("authenticates encrypted records and randomizes every nonce", () => {
  const key = randomBytes(32), a = seal(key, "private password", "record:a"), b = seal(key, "private password", "record:a")
  expect(a).not.toEqual(b)
  expect(JSON.stringify(a)).not.toContain("private password")
  expect(unseal(key, a, "record:a")).toBe("private password")
  expect(() => unseal(key, a, "record:b")).toThrow()
  expect(() => unseal(randomBytes(32), a, "record:a")).toThrow()
  expect(() => unseal(key, { ...a, tag: randomBytes(16).toString("base64") }, "record:a")).toThrow()
})
it("derives keys from a strong master password and independent salt", async () => {
  const value = salt(), a = await derive("a long master password", value), b = await derive("a long master password", value)
  expect(a).toEqual(b)
  expect(await derive("a long master password", salt())).not.toEqual(a)
  await expect(derive("short", value)).rejects.toThrow()
}, 15000)
it("matches exact HTTPS origin including ports", () => {
  expect(credentialOrigin("https://example.test:8443/login?a=1")).toBe("https://example.test:8443")
  expect(() => credentialOrigin("http://example.test")).toThrow()
  expect(() => credentialOrigin("file:///tmp/login.html")).toThrow()
})
