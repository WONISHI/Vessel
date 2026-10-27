import { expect, it } from "vitest"
import { preparePdfExport } from "@main/menu/pdf-options"
import type { PdfExportOptions } from "@vessel/type/native-menu"
const options: PdfExportOptions = { paper: "A4", landscape: true, marginMm: 18, fontSize: 14, printBackground: false, pageNumbers: true }

it("applies landscape, paper, margins and page numbers consistently to CSS and the PDF engine", () => {
  const result = preparePdfExport("<html><head><style>@page{size:A4;margin:18mm}</style></head><body>正文</body></html>", options)
  expect(result.html).toContain("size:A4 landscape;margin:18mm")
  expect(result.html).toContain("font-size:14px")
  expect(result.print).toMatchObject({ pageSize: "A4", landscape: true, preferCSSPageSize: true, printBackground: false, displayHeaderFooter: true })
  expect(result.print.margins?.bottom).toBeCloseTo(18 / 25.4)
  expect(result.print.footerTemplate).toContain('class="pageNumber"')
  expect(preparePdfExport("<p>text</p>", { ...options, paper: "Letter", landscape: false }).html).toContain("size:Letter portrait")
})
it("rejects invalid configuration and preserves existing unconfigured exports", () => {
  for (const invalid of [{ marginMm: -1 }, { marginMm: NaN }, { fontSize: 100 }, { fontSize: Infinity }, { paper: "invalid" }, { marginMm: 5, pageNumbers: true }]) expect(() => preparePdfExport("<p>test</p>", { ...options, ...invalid } as PdfExportOptions)).toThrow()
  expect(preparePdfExport("original")).toEqual({ html: "original", print: { printBackground: true, preferCSSPageSize: true } })
})
