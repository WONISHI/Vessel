import { expect, it } from "vitest"
import { countDocument } from "@/components/core/canvas/variants/markdown/count-document"
import { decorateCodeBlocks } from "@/components/core/canvas/variants/markdown/code-blocks"
it("counts Unicode characters and words, including empty documents", () => {
  expect(countDocument("")).toEqual({ words: 0, characters: 0, lines: 0 })
  expect(countDocument("Hello world\n😀")).toEqual({ words: 2, characters: 14, lines: 2 })
  expect(countDocument("你好 世界").words).toBe(4)
})
it("labels code previews without modifying editable source or image embeds", () => {
  const root = document.createElement("div")
  root.innerHTML =
    '<div data-type="code-block"><pre class="vditor-ir__marker"><code class="language-js">const x = 1</code></pre><pre class="vditor-ir__preview"><code class="language-js">const x = 1</code></pre></div><div data-type="code-block" class="vessel-image-block"><pre class="vditor-ir__marker"><code class="language-vessel-obsidian-image">image</code></pre></div>'
  const source = root.querySelector(".vditor-ir__marker")!.innerHTML
  decorateCodeBlocks(root)
  decorateCodeBlocks(root)
  expect(root.querySelectorAll(".vessel-code-frame")).toHaveLength(1)
  expect(root.querySelector<HTMLElement>(".vessel-code-frame")!.dataset.language).toBe("js")
  expect(root.querySelector(".vditor-ir__marker")!.innerHTML).toBe(source)
})

it("counts Chinese per character and keeps English apostrophes, hyphens and decimal numbers together", () => {
  expect(countDocument("你好世界 hello world").words).toBe(6)
  expect(countDocument("don't well-known 1,234.56").words).toBe(3)
  expect(countDocument("日本語かなカナ").words).toBe(7)
  expect(countDocument("😀")).toMatchObject({ words: 0, characters: 2 })
})
it("excludes YAML properties while retaining body whitespace and Markdown source characters", () => {
  const body = "# 标题\nhello **world**\n"
  expect(countDocument(`---\ntitle: ignored\ntags: [test]\n---\n${body}`)).toEqual(countDocument(body))
  expect(countDocument(body).characters).toBe(body.length)
  expect(countDocument(" \n")).toEqual({ words: 0, characters: 2, lines: 2 })
})
