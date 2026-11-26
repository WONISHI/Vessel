import { expect, it } from "vitest"
import { parseJsonInput } from "@/pages/debug/json/parse-json-input"

it("parses the copied double-escaped structure and nonstandard URL-colon escapes", () => {
  const text = String.raw`"{\\"key\\":\\"2108449341377019905\\",\\"title\\":\\"考后复核材料申报\\",\\"data\\":{\\"candidateName\\":\\"测试用户\\",\\"applicationAttachments\\":[{\\"url\\":\\"http\://example.test/file.pdf\\",\\"filePath\\":\\"https\://example.test/download?id=2122262685376512002\\",\\"percentage\\":100}]},\\"metadata\\":{\\"usePassApi\\":true}}"`
  expect(parseJsonInput(text)).toEqual({ key: "2108449341377019905", title: "考后复核材料申报", data: { candidateName: "测试用户", applicationAttachments: [{ url: "http://example.test/file.pdf", filePath: "https://example.test/download?id=2122262685376512002", percentage: 100 }] }, metadata: { usePassApi: true } })
})

it("unwraps repeated JSON encoding while preserving field strings, paths, quotes and newlines", () => {
  const value = { id: "2122262685376512002", path: "C:\\notes\\new.json", note: '第一行\n他说："你好"', embedded: '{"keep":"string"}', literal: "https\\://keep-this", attachments: [{ fileName: "测试.pdf" }] }
  let text = JSON.stringify(value)
  for (let i = 0; i < 5; i++) {
    expect(parseJsonInput(text)).toEqual(value)
    text = JSON.stringify(text)
  }
  const brokenCopy = JSON.stringify(JSON.stringify(value)).replace(/(\\+)"/g, (_match, slashes: string) => "\\".repeat(slashes.length * 2) + '"')
  expect(parseJsonInput(brokenCopy)).toEqual(value)
  expect(parseJsonInput(String.raw`{\"name\":\"测试\",\"ok\":true}`)).toEqual({ name: "测试", ok: true })
})

it("preserves valid primitives, normal JSON and JSON-looking field values", () => {
  for (const text of ['"123"', '"true"', '"null"', '"普通字符串"', '"{invalid}"', "0", "false", "null", '[1,{"a":true}]']) expect(parseJsonInput(text)).toEqual(JSON.parse(text))
  const text = JSON.stringify({ path: "C:\\new\\file", json: '{"nested":1}', url: "http\\://literal" })
  expect(parseJsonInput(text)).toEqual(JSON.parse(text))
})

it("rejects malformed structures and executable JavaScript without repairing arbitrary syntax", () => {
  for (const text of ['{"a":}', '{"a":1,}', '{a:1}', '(()=>({a:1}))()', "not JSON"]) expect(() => parseJsonInput(text)).toThrow()
})

it("JSON-izes every nested object/array string without coercing identifiers or ordinary text", async () => {
  const { jsonizeJsonInput } = await import("@/pages/debug/json/parse-json-input")
  const input = JSON.stringify({
    formId: "2124707628909002754",
    item: JSON.stringify({ data: JSON.stringify({ nested: '["{\\"ok\\":true}"]', name: "测试用户" }) }),
    siblings: [JSON.stringify({ child: '{"count":1}' }), '[1,2]', '"{\\"multi\\":true}"'],
    id: "00123", enabled: "true", missing: "null", decimal: "1.20", text: "普通文本",
    malformed: '{"broken":}', path: 'C:\\notes\\file.json', empty: "", quoted: '"hello"'
  })
  expect(jsonizeJsonInput(input)).toEqual({
    formId: "2124707628909002754",
    item: { data: { nested: [{ ok: true }], name: "测试用户" } },
    siblings: [{ child: { count: 1 } }, [1, 2], { multi: true }],
    id: "00123", enabled: "true", missing: "null", decimal: "1.20", text: "普通文本",
    malformed: '{"broken":}', path: 'C:\\notes\\file.json', empty: "", quoted: '"hello"'
  })
  expect(jsonizeJsonInput(JSON.stringify(JSON.stringify({ field: '{"ok":true}' })))).toEqual({ field: { ok: true } })
  expect(() => jsonizeJsonInput('{"invalid":}')).toThrow()
})
