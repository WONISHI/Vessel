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
  expect(credentialOrigin("http://example.test")).toBe("http://example.test")
  expect(() => credentialOrigin("file:///tmp/login.html")).toThrow()
})

it.each([
 ['http://localhost:9525/login', 'http://localhost:9525'],
 ['http://127.0.0.1:9525/login', 'http://127.0.0.1:9525'],
 ['http://127.1.2.3:8080/login', 'http://127.1.2.3:8080'],
 ['http://[::1]:9525/login', 'http://[::1]:9525'],
 ['http://app.localhost:3000/login', 'http://app.localhost:3000']
])('accepts local development origin %s', (url, origin) => {
 expect(credentialOrigin(url)).toBe(origin)
})
it.each(['file:///tmp/login.html', 'data:text/html,login', 'javascript:alert(1)', 'chrome-extension://extension/login', 'not a url'])('rejects unsupported origin %s', (url) => {
 expect(() => credentialOrigin(url)).toThrow()
})

it.each([
 ['http://39.106.89.88:8090/users/sign_in', 'http://39.106.89.88:8090'],
 ['http://192.168.1.1/login', 'http://192.168.1.1'],
 ['http://localhost.attacker.test:9525/login', 'http://localhost.attacker.test:9525']
])('supports HTTP sites without merging origins: %s', (url, expected) => {
 expect(credentialOrigin(url)).toBe(expected)
 expect(credentialOrigin(url)).not.toBe('http://localhost:9525')
})
