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

it("leaves markdown-table previews visible instead of forcing code-source display", () => {
  const root = document.createElement("div")
  root.innerHTML = '<div data-type="code-block" class="vessel-direct-code"><pre class="vditor-ir__marker vessel-code-frame" data-language="markdown-table"><code class="language-markdown-table">{"caption":"test"}</code></pre><pre class="vditor-ir__preview"><code class="language-markdown-table">{"caption":"test"}</code></pre></div>'
  decorateCodeBlocks(root, false)
  const block = root.firstElementChild!
  expect(block.classList.contains("vessel-direct-code")).toBe(false)
  expect(block.querySelector(".vessel-code-frame")).toBeNull()
})

it("dispatches vessel-code-context-menu on right-clicking code block header", () => {
  const root = document.createElement("div")
  root.innerHTML = '<div data-type="code-block"><pre class="vditor-ir__marker"><code class="language-typescript">console.log("hello")</code></pre></div>'
  document.body.appendChild(root)
  decorateCodeBlocks(root, false)

  const pre = root.querySelector<HTMLElement>("pre.vessel-code-frame")!
  expect(pre).not.toBeNull()
  pre.getBoundingClientRect = () => ({
    top: 100,
    bottom: 300,
    left: 50,
    right: 450,
    width: 400,
    height: 200,
    x: 50,
    y: 100,
    toJSON: () => {}
  })

  let contextMenuDetail: any = null
  root.addEventListener("vessel-code-context-menu", (e: any) => {
    contextMenuDetail = e.detail
  })

  // Right-click in header (y = 120, which is top + 20 <= 40)
  const contextMenuEvent = new MouseEvent("contextmenu", {
    bubbles: true,
    cancelable: true,
    clientX: 150,
    clientY: 120
  })
  pre.dispatchEvent(contextMenuEvent)

  expect(contextMenuEvent.defaultPrevented).toBe(true)
  expect(contextMenuDetail).not.toBeNull()
  expect(contextMenuDetail.x).toBe(150)
  expect(contextMenuDetail.y).toBe(120)
  expect(contextMenuDetail.block).toBe(root.firstElementChild)

  // Right-click inside code area (y = 160, which is top + 60 > 40)
  contextMenuDetail = null
  const contentEvent = new MouseEvent("contextmenu", {
    bubbles: true,
    cancelable: true,
    clientX: 150,
    clientY: 160
  })
  pre.dispatchEvent(contentEvent)
  expect(contextMenuDetail).toBeNull()

  root.remove()
})

it("dispatches vessel-code-language only on left-click in header", () => {
  const root = document.createElement("div")
  root.innerHTML = '<div data-type="code-block"><pre class="vditor-ir__marker"><code class="language-typescript">console.log("hello")</code></pre></div>'
  document.body.appendChild(root)
  decorateCodeBlocks(root, false)

  const pre = root.querySelector<HTMLElement>("pre.vessel-code-frame")!
  pre.getBoundingClientRect = () => ({
    top: 100,
    bottom: 300,
    left: 50,
    right: 450,
    width: 400,
    height: 200,
    x: 50,
    y: 100,
    toJSON: () => {}
  })

  let languageClicked = false
  root.addEventListener("vessel-code-language", () => {
    languageClicked = true
  })

  // Right-click should not trigger code-language dialog
  pre.dispatchEvent(new MouseEvent("mousedown", { button: 2, clientY: 120, bubbles: true }))
  expect(languageClicked).toBe(false)

  // Left-click should trigger code-language dialog
  pre.dispatchEvent(new MouseEvent("mousedown", { button: 0, clientY: 120, bubbles: true }))
  expect(languageClicked).toBe(true)

  root.remove()
})
