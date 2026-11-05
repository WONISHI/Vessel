import { readPageTitles } from "@/components/pdf-document/components/pdf-heading-text"
import type { PDFPageProxy } from "pdfjs-dist"
import { expect, it } from "vitest"

const item = (str: string, size: number, y: number) => ({
  str, width: str.length * size, dir: "ltr", transform: [size, 0, 0, size, 40, y]
})
const makePage = (items: ReturnType<typeof item>[]) => ({
  getViewport: () => ({
    height: 800,
    convertToViewportPoint: (x: number, y: number) => [x, 800 - y]
  }),
  getTextContent: async () => ({ items })
}) as unknown as PDFPageProxy

it("combines wrapped titles and keeps separate headings on the same PDF page", async () => {
  const titles = await readPageTitles(makePage([
    item("开篇介绍：Node 10 年大跃进与", 28, 710),
    item("当下在互联网研发中的地位", 28, 675),
    item("这段是普通正文，内容更长，用来建立文档正文字号。", 12, 628),
    item("正文段落继续介绍浏览器与服务端的开发历史。", 12, 603),
    item("发展历程", 18, 480),
    item("这一部分的文字属于正文，不能作为章节标题。", 12, 448)
  ]), 2)
  expect(titles.map(({ text }) => text)).toEqual([
    "开篇介绍：Node 10 年大跃进与当下在互联网研发中的地位", "发展历程"
  ])
  expect(titles.map(({ page }) => page)).toEqual([2, 2])
  expect(titles[0].offset).toBeLessThan(titles[1].offset)
})

it("does not invent page labels for an image-only PDF", async () => {
  expect(await readPageTitles(makePage([]), 1)).toEqual([])
})
