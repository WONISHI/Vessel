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

it("recognizes smaller H3 titles without mistaking normal bold-size body lines for headings", async () => {
  const titles = await readPageTitles(makePage([
    item("面试题", 21, 760),
    item("场景题", 15.75, 700),
    item("前端路由性能", 12.28, 650),
    item("前端路由性能优化不能只背懒加载，要按问题来源来答。", 10.5, 600),
    item("一句话结论", 10.5, 560),
    item("路由优化是控制资源加载时机，加上管控组件生命周期。", 10.5, 540)
  ]), 1)
  expect(titles.map((title) => title.text)).toEqual(["面试题", "场景题", "前端路由性能"])
  expect(titles[2].size).toBeCloseTo(12.5)
})
