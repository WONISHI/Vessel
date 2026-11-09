import { expect, it } from "vitest"
import { runApiScript } from "@main/modules/api-client/script-runner"
import { cookieHeaderFor, parseSetCookie } from "@main/modules/api-client/cookie-jar"

it("runs pre-request scripts that mutate variables, url and headers", () => {
  const vars: Record<string, string> = { host: "example.com" }
  const envUpdates: Record<string, string | null> = {}
  const request = { method: "GET", url: "https://{{host}}/a", headers: {} as Record<string, string> }
  const outcome = runApiScript(`pm.environment.set("token", "abc"); pm.environment.unset("host"); pm.request.headers.add({ key: "X-Id", value: 7 }); pm.request.url = pm.request.url + "?x=1"; console.log("ok", { a: 1 })`, { vars, envUpdates, request })
  expect(outcome.error).toBeUndefined()
  expect(vars).toEqual({ token: "abc" })
  expect(envUpdates).toEqual({ token: "abc", host: null })
  expect(request).toEqual({ method: "GET", url: "https://{{host}}/a?x=1", headers: { "X-Id": "7" } })
  expect(outcome.logs).toEqual(['ok {"a":1}'])
})

it("evaluates Postman-style assertions against the response", () => {
  const outcome = runApiScript(
    `
    pm.test("status", () => pm.response.to.have.status(201))
    pm.test("json", () => { const body = pm.response.json(); pm.expect(body.items).to.have.lengthOf(2); pm.expect(body).to.have.property("ok", true); pm.expect(body.items).to.include(2); pm.expect(body.name).to.not.equal("x") })
    pm.test("header", () => pm.response.to.have.header("content-type"))
    pm.test("fails", () => pm.expect(1).to.be.above(5))
    pm.environment.set("id", pm.response.json().items[0])
  `,
    { vars: {}, envUpdates: {}, request: { method: "GET", url: "u", headers: {} }, response: { code: 201, status: "Created", responseTime: 5, headers: { "Content-Type": "application/json" }, body: '{"ok":true,"items":[1,2],"name":"y"}' } }
  )
  expect(outcome.tests.map((t) => [t.name, t.passed])).toEqual([["status", true], ["json", true], ["header", true], ["fails", false]])
})

it("reports script errors and enforces a timeout", () => {
  expect(runApiScript("throw new Error('boom')", { vars: {}, envUpdates: {}, request: { method: "GET", url: "", headers: {} } }).error).toBe("boom")
  expect(runApiScript("while (true) {}", { vars: {}, envUpdates: {}, request: { method: "GET", url: "", headers: {} } }).error).toMatch(/timed out/i)
})

it("parses Set-Cookie and matches cookies by domain, path, secure and expiry", () => {
  const url = new URL("https://api.example.com/v1/login")
  const now = 1_000_000
  const session = parseSetCookie("sid=1; Path=/; HttpOnly; Secure", url, now)!
  const scoped = parseSetCookie("pref=dark; Domain=example.com; Path=/v1; Max-Age=60", url, now)!
  const expired = parseSetCookie("old=1; Max-Age=0", url, now)!
  expect(session).toMatchObject({ domain: "api.example.com", path: "/", secure: true, httpOnly: true, expires: null })
  expect(scoped).toMatchObject({ domain: ".example.com", path: "/v1", expires: now + 60_000 })
  expect(parseSetCookie("x=1; Domain=evil.com", url, now)).toBeNull()
  const jar = [session, scoped, expired]
  expect(cookieHeaderFor(jar, new URL("https://api.example.com/v1/users"), now + 1)).toBe("pref=dark; sid=1")
  expect(cookieHeaderFor(jar, new URL("http://api.example.com/v1/users"), now + 1)).toBe("pref=dark")
  expect(cookieHeaderFor(jar, new URL("https://www.example.com/v2"), now + 1)).toBe("")
  expect(cookieHeaderFor(jar, new URL("https://www.example.com/v1x"), now + 1)).toBe("")
  expect(cookieHeaderFor(jar, new URL("https://www.example.com/v1/a"), now + 120_000)).toBe("")
})
