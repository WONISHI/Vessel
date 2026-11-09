import { describe, expect, it } from "vitest"
import { applyEnvUpdates, draftFromRecord, draftToRecord, newDraft } from "@/pages/postman/lib/model"
import { paramsFromUrl, urlWithParams } from "@/pages/postman/lib/url-params"
import { parseCurl, tokenizeShell } from "@/pages/postman/lib/curl"
import { generateSnippet, normalizeRequest } from "@/pages/postman/lib/codegen"
import { exportPostman, importPostman } from "@/pages/postman/lib/postman-collection"

describe("params ↔ url", () => {
  it("keeps disabled rows in the table and templates intact", () => {
    const params = paramsFromUrl("{{baseUrl}}/users?page=1&q={{term}}&flag#top", [{ key: "debug", value: "1", enabled: false }])
    expect(params).toEqual([
      { key: "page", value: "1", enabled: true },
      { key: "q", value: "{{term}}", enabled: true },
      { key: "flag", value: "", enabled: true },
      { key: "debug", value: "1", enabled: false }
    ])
    expect(urlWithParams("{{baseUrl}}/users?old=1#top", [...params.slice(0, 2), { key: "debug", value: "1", enabled: false }])).toBe("{{baseUrl}}/users?page=1&q={{term}}#top")
    expect(urlWithParams("https://x.test/a?b=1", [])).toBe("https://x.test/a")
  })

  it("folds legacy separate params into the url when loading saved records", () => {
    const record = draftToRecord(newDraft({ url: "https://x.test/a" }), "r1")
    const draft = draftFromRecord({ ...record, params: JSON.stringify([{ key: "a", value: "1", enabled: true }, { key: "b", value: "2", enabled: false }]) })
    expect(draft.url).toBe("https://x.test/a?a=1")
    expect(draft.params).toHaveLength(2)
  })

  it("applies env updates from scripts", () => {
    expect(applyEnvUpdates([{ key: "a", value: "1", enabled: false }, { key: "b", value: "2", enabled: true }], { a: "9", b: null, c: "3" })).toEqual([{ key: "a", value: "9", enabled: true }, { key: "c", value: "3", enabled: true }])
  })
})

describe("cURL", () => {
  it("tokenizes quotes and continuations", () => {
    expect(tokenizeShell(`curl 'a b' "c \\"d\\"" $'e\\nf' \\\n  g`)).toEqual(["curl", "a b", 'c "d"', "e\nf", "g"])
  })

  it("parses devtools-style commands", () => {
    const draft = parseCurl(`curl 'https://api.test/v1/items?page=2' -H 'content-type: application/json' -H 'Authorization: Bearer x' --data-raw '{"a":1}' --compressed`)
    expect(draft).toMatchObject({ method: "POST", url: "https://api.test/v1/items?page=2", bodyType: "raw", rawType: "json", bodyRaw: '{\n  "a": 1\n}' })
    expect(draft.params).toEqual([{ key: "page", value: "2", enabled: true }])
    expect(draft.headers.map((h) => h.key)).toEqual(["content-type", "Authorization"])
    expect(parseCurl("curl -XPUT -u me:pw -d a=1 -d b=x%20y https://x.test")).toMatchObject({ method: "PUT", authType: "basic", auth: { username: "me", password: "pw" }, bodyType: "x-www-form-urlencoded", bodyForm: [{ key: "a", value: "1", enabled: true }, { key: "b", value: "x y", enabled: true }] })
    expect(parseCurl("curl -G https://x.test/s -d q=1").url).toBe("https://x.test/s?q=1")
    expect(() => parseCurl("wget x")).toThrow()
  })

  it("round-trips through the generated cURL snippet", () => {
    const draft = newDraft({ method: "POST", url: "{{base}}/it's", bodyType: "raw", bodyRaw: '{"n":"o\'k"}', authType: "bearer", auth: { ...newDraft().auth, token: "{{t}}" } })
    const snippet = generateSnippet("curl", normalizeRequest(draft, { base: "https://x.test", t: "tok" }))
    const parsed = parseCurl(snippet)
    expect(parsed).toMatchObject({ method: "POST", url: "https://x.test/it's", bodyRaw: '{\n  "n": "o\'k"\n}' })
    expect(parsed.headers).toContainEqual({ key: "Authorization", value: "Bearer tok", enabled: true })
    for (const language of ["fetch", "axios", "python", "http"] as const) expect(generateSnippet(language, normalizeRequest(draft)).length).toBeGreaterThan(20)
  })
})

describe("Postman collection", () => {
  it("imports folders, bodies, auth and scripts and exports them back", () => {
    const result = importPostman({
      info: { name: "Demo", schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json" },
      variable: [{ key: "base", value: "https://x.test" }],
      item: [
        { name: "Folder", item: [{ name: "Create", event: [{ listen: "test", script: { exec: ["pm.test('ok', () => {})"] } }], request: { method: "POST", url: { raw: "{{base}}/items?a=1", query: [{ key: "a", value: "1" }, { key: "off", value: "2", disabled: true }] }, header: [{ key: "X", value: "1" }], body: { mode: "raw", raw: "{}", options: { raw: { language: "json" } } }, auth: { type: "bearer", bearer: [{ key: "token", value: "abc" }] } } }] },
        { name: "Plain", request: "https://x.test/plain" }
      ]
    })
    if (result.kind !== "collection") throw new Error("expected collection")
    expect(result.count).toBe(2)
    expect(result.environment).toEqual({ name: "Demo 变量", variables: [{ key: "base", value: "https://x.test", enabled: true }] })
    const create = draftFromRecord(result.payload.requests[0])
    expect(create).toMatchObject({ method: "POST", url: "{{base}}/items?a=1", bodyType: "raw", rawType: "json", authType: "bearer", auth: { token: "abc" }, tests: "pm.test('ok', () => {})" })
    expect(create.params).toContainEqual({ key: "off", value: "2", enabled: false })

    const collections = result.payload.collections.map((item) => ({ ...item, createdAt: 0 }))
    const exported = exportPostman(collections[0].id, collections, result.payload.requests) as { item: { name: string; item?: { request: { auth: unknown } }[] }[] }
    expect(exported.item.map((item) => item.name)).toEqual(["Folder", "Plain"])
    expect(exported.item[0].item?.[0].request.auth).toEqual({ type: "bearer", bearer: [{ key: "token", value: "abc", type: "string" }] })
    const again = importPostman(exported)
    expect(again.kind === "collection" && again.count).toBe(2)
    expect(importPostman({ name: "Env", values: [{ key: "a", value: "1", disabled: true }] })).toEqual({ kind: "environment", environment: { name: "Env", variables: [{ key: "a", value: "1", enabled: false }] } })
  })
})
