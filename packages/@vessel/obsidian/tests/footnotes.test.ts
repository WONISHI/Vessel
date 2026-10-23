import { expect, it } from "vitest"
import { parseFootnotes } from "../src/footnotes"
it("parses definitions, multiline content and persistent annotated text boundaries", () => {
  const source = '前文<span data-vessel-footnote="1">选中文字</span>[^1] 后文\n\n[^1]: 补充说明\n    第二行'
  const result = parseFootnotes(source)
  expect(result.definitions[0]).toMatchObject({ id: "1", content: "补充说明\n第二行" })
  expect(result.references).toHaveLength(1)
  expect(result.annotations[0]).toMatchObject({ id: "1", content: "选中文字" })
  expect(source.slice(result.annotations[0].start, result.annotations[0].end)).toContain('data-vessel-footnote="1"')
})
it("ignores code examples, escaped references and definition labels", () => {
  const result = parseFootnotes("`[^1]`\n```md\n[^2]: 假脚注\n正文[^2]\n```\n\\[^3]\n正文[^4]\n\n[^4]: 真脚注")
  expect(result.definitions.map((item) => item.id)).toEqual(["4"])
  expect(result.references.map((item) => item.id)).toEqual(["4"])
})
