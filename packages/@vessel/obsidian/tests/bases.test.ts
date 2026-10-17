import { expect, it } from "vitest"
import { createBaseFile, parseBase, queryBase } from "@vessel/obsidian/bases"

it("queries Chinese YAML properties using vault folders, sort, view order and display names", () => {
  const base = parseBase(
    `filters:\n  and:\n    - file.inFolder("工作内容/白云机场")\n    - file.ext == "md"\nproperties:\n  file.name:\n    displayName: 项目名称\nviews:\n  - type: table\n    name: 表格\n    order: [file.name, http地址, 账号]\n    sort:\n      - property: 账号\n        direction: DESC`
  )
  const files = [createBaseFile("工作内容/白云机场/A.md", "---\nhttp地址: https://example.com\n账号: 1\n---\n"), createBaseFile("工作内容/白云机场/子目录/B.md", "---\n账号: 2\n---\n"), createBaseFile("其他/C.md")]
  const result = queryBase(base, files)
  expect(result.columns.map((column) => column.label)).toEqual(["项目名称", "http地址", "账号"])
  expect(result.rows.map((row) => row.values["file.name"])).toEqual(["B", "A"])
  expect(result.rows[1].values["http地址"]).toBe("https://example.com")
})

it("combines global and per-view filters, and NOT excludes any matching condition", () => {
  const base = parseBase(`filters:\n  not:\n    - status == "done"\n    - file.hasTag("private")\nviews:\n  - type: table\n    name: open\n    filters: price > 2\n    limit: 1\n    order: [file.name]`)
  expect(queryBase(base, [createBaseFile("done.md", "---\nstatus: done\nprice: 9\n---"), createBaseFile("private.md", "---\nprice: 9\n---\n#private/sub"), createBaseFile("open.md", "---\nprice: 3\n---"), createBaseFile("cheap.md", "---\nprice: 1\n---")]).rows.map((row) => row.path)).toEqual([
    "open.md"
  ])
})

it("evaluates arithmetic, nested formulas, this.file and bracket access without executing code", () => {
  const base = parseBase(`formulas:\n  unit: price / count\n  text: 'if(formula.unit > 1, formula.unit.toFixed(2) + " 元", "低价")'\nviews:\n  - type: table\n    name: table\n    filters: file.folder == this.file.folder\n    order: [file.name, formula.text]`)
  const file = createBaseFile("notes/A.md", "---\nprice: 10\ncount: 2\n---")
  expect(queryBase(base, [file], 0, createBaseFile("notes/list.base")).rows[0].values["formula.text"]).toBe("5.00 元")
  const invalid = parseBase('views:\n  - type: table\n    filters: note.constructor.constructor("return 1")()')
  expect(() => queryBase(invalid, [file])).toThrow(/不允许|不支持/)
  expect(() => parseBase("views: [")).toThrow()
  expect(() => queryBase(parseBase("views:\n  - type: table\n    filters: file.unknown()"), [file])).toThrow(/不支持/)
})

it("reports cycles, missing formulas and unsupported views rather than inventing values", () => {
  const document = parseBase(`formulas:\n  a: formula.b\n  b: formula.a\nviews:\n  - type: table\n    order: [formula.a]\n  - type: cards`)
  const result = queryBase(document, [createBaseFile("A.md")])
  expect(result.warnings.join()).toContain("循环")
  expect(result.rows[0].values["formula.a"]).toBeNull()
  expect(() => queryBase(document, [], 1)).toThrow(/cards/)
})

it("keeps rows when a removed formula remains in order, sort or grouping", () => {
  const base = parseBase("views:\n  - type: table\n    order: [file.name, formula.http地址]\n    sort:\n      - property: formula.http地址\n        direction: ASC\n    groupBy:\n      property: formula.http地址")
  const result = queryBase(base, [createBaseFile("notes/B.md"), createBaseFile("notes/A.md")])
  expect(result.rows.map((row) => row.path)).toEqual(["notes/A.md", "notes/B.md"])
  expect(result.rows[0].values["formula.http地址"]).toBeNull()
  expect(result.warnings.join()).toContain("公式 http地址 不存在")
})

it("reads static template frontmatter without executing standalone or inline Templater scripts", () => {
  const file = createBaseFile(
    "template/repo-template.md",
    `---
<%*
throw new Error("must never execute")
%>
状态: 待办
标题: <% tp.file.title %>
日期: "<% tp.date.now() %>"
嵌套:
  静态: 保留
  动态: <% tp.file.title %>
---
# Template`
  )
  expect(file.properties).toMatchObject({ 状态: "待办", 标题: null, 日期: null, 嵌套: { 静态: "保留", 动态: null } })
  expect(() => createBaseFile("bad.md", "---\nstatus: [\n---")).toThrow(/YAML/)
})

it("resolves stale formula references to existing note properties for columns, sorting and grouping", () => {
  const base = parseBase("views:\n  - type: table\n    order: [file.name, formula.http地址]\n    sort:\n      - property: formula.http地址\n        direction: ASC\n    groupBy:\n      property: formula.http地址")
  const files = [createBaseFile("A.md", "---\nhttp地址: https://z.example\n---"), createBaseFile("B.md", "---\nhttp地址: https://a.example\n---"), createBaseFile("C.md")]
  const result = queryBase(base, files)
  expect(result.warnings).toEqual([])
  expect(result.rows.map((row) => row.path)).toEqual(["B.md", "A.md", "C.md"])
  expect(result.rows[0].values["formula.http地址"]).toBe("https://a.example")
  expect(result.rows[0].group).toBe("https://a.example")
  expect(result.rows[2].values["formula.http地址"]).toBeNull()
})

it("prefers a defined formula over a note property with the same name", () => {
  const base = parseBase(`formulas:\n  http地址: '"computed"'\nviews:\n  - type: table\n    order: [formula.http地址]`)
  const result = queryBase(base, [createBaseFile("A.md", "---\nhttp地址: https://example.com\n---")])
  expect(result.rows[0].values["formula.http地址"]).toBe("computed")
  expect(result.warnings).toEqual([])
})

it("treats blank global and nested view filters as unset and blank formulas as empty cells", () => {
  const base = parseBase(`filters: " "
formulas:
  blank: " "
  unused: "unsupported("
views:
  - type: table
    filters:
      and:
        - ""
        - status == "open"
    order: [file.name, formula.blank]
`)
  const result = queryBase(base, [createBaseFile("A.md", "---\nstatus: open\n---"), createBaseFile("B.md", "---\nstatus: done\n---")])
  expect(result.rows.map((row) => row.path)).toEqual(["A.md"])
  expect(result.rows[0].values["formula.blank"]).toBeNull()
  expect(result.warnings).toEqual([])
})

it("reports a used invalid formula without preventing valid columns from rendering", () => {
  const base = parseBase(`formulas:
  broken: "unsupported("
views:
  - type: table
    order: [file.name, formula.broken]
`)
  const result = queryBase(base, [createBaseFile("A.md")])
  expect(result.rows[0].values["file.name"]).toBe("A")
  expect(result.rows[0].values["formula.broken"]).toBeNull()
  expect(result.warnings[0]).toContain("formula.broken")
})

it("supports empty-name formulas retained in Obsidian view sorting", () => {
  const base = parseBase(`formulas:
  "": ""
  Untitled: ""
views:
  - type: table
    order: [file.name]
    sort:
      - property: formula.Untitled
        direction: DESC
      - property: formula.
        direction: DESC
`)
  const result = queryBase(base, [createBaseFile("B.md"), createBaseFile("A.md")])
  expect(result.rows.map((row) => row.path)).toEqual(["A.md", "B.md"])
  expect(result.warnings).toEqual([])
})
