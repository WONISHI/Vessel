import { expect, it } from "vitest"
import { countDocument } from "../../src/renderer/src/components/core/canvas/variants/markdown/count-document"
import { decorateCodeBlocks } from "../../src/renderer/src/components/core/canvas/variants/markdown/code-blocks"
it("counts Unicode characters and words, including empty documents", () => {
  expect(countDocument("")).toEqual({ words: 0, characters: 0, lines: 0 })
  expect(countDocument("Hello world\n😀")).toEqual({ words: 2, characters: 13, lines: 2 })
  expect(countDocument("你好 世界").words).toBe(2)
})
it("labels code previews without modifying editable source or image embeds", () => {
  const root = document.createElement("div")
  root.innerHTML = '<pre class="vditor-ir__marker"><code>```js\nconst x = 1</code></pre><div class="vditor-ir__preview"><pre><code class="language-js">const x = 1</code></pre></div><div class="vditor-ir__preview"><pre><code class="language-vessel-obsidian-image">image</code></pre></div>'
  const source = root.querySelector(".vditor-ir__marker")!.innerHTML
  decorateCodeBlocks(root)
  decorateCodeBlocks(root)
  expect(root.querySelectorAll(".vessel-code-frame")).toHaveLength(1)
  expect(root.querySelector<HTMLElement>(".vessel-code-frame")!.dataset.language).toBe("js")
  expect(root.querySelector(".vditor-ir__marker")!.innerHTML).toBe(source)
})
