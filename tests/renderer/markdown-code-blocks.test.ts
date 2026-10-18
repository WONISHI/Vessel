import { expect, it } from "vitest"
import { decorateCodeBlocks } from "@/components/core/canvas/variants/markdown/code-blocks"

it("leaves Mermaid SVG previews visible instead of forcing code-source display", () => {
  const root = document.createElement("div")
  root.innerHTML = '<div data-type="code-block" class="vessel-direct-code"><pre class="vditor-ir__marker vessel-code-frame" data-language="mermaid"><code class="language-mermaid">flowchart TD\nA--&gt;B</code></pre><pre class="vditor-ir__preview"><code class="language-mermaid"><svg><text>A</text></svg></code></pre></div>'
  decorateCodeBlocks(root, true)
  const block = root.firstElementChild!
  expect(block.classList.contains("vessel-direct-code")).toBe(false)
  expect(block.querySelector(".vessel-code-frame")).toBeNull()
  expect(block.querySelector("svg")).not.toBeNull()
  expect(block.querySelector("pre.vditor-ir__marker code")?.textContent).toBe("flowchart TD\nA-->B")
})
