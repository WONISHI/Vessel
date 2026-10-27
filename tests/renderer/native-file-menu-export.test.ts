import { expect, it } from "vitest"
import { printableMarkdown } from "@/components/native-file-menu/document-bridge"

it("exports rendered Markdown and visible code without editor markers or scripts", () => {
  const root = document.createElement("div")
  root.innerHTML = '<h1><span class="vditor-ir__marker"># </span>Title</h1><div class="vessel-direct-code"><pre class="vditor-ir__marker"><code>&lt;code&gt;</code></pre><pre class="vditor-ir__preview"><code>duplicate</code></pre></div><div class="vessel-image-block"><pre class="vditor-ir__marker"><code>encoded-image</code></pre><pre class="vditor-ir__preview"><img src="data:image/png;base64,example"></pre></div><script>alert(1)</script>'
  const html = printableMarkdown(root)
  const exported = new DOMParser().parseFromString(html, "text/html")
  expect(exported.querySelector("h1")?.textContent).toBe("Title")
  expect(exported.querySelector("code")?.textContent).toBe("<code>")
  expect(exported.querySelectorAll("code")).toHaveLength(1)
  expect(exported.querySelector("img")).toBeTruthy()
  expect(exported.querySelector("script")).toBeNull()
  expect(exported.body.textContent).not.toContain("encoded-image")
  expect(root.querySelector("script")).toBeTruthy()
})

it("keeps wikilink labels and task completion while removing table editing controls", () => {
  const root = document.createElement("div")
  root.innerHTML = '<div class="vessel-table-toolbar"><button>合并</button></div><table><tr><td><button data-wiki-target="note.md">链接内容</button><input type="checkbox"></td></tr></table>'
  root.querySelector<HTMLInputElement>("input")!.checked = true
  const exported = new DOMParser().parseFromString(printableMarkdown(root), "text/html")
  expect(exported.body.textContent).toContain("链接内容☑")
  expect(exported.querySelector(".vessel-table-toolbar")).toBeNull()
  expect(exported.querySelector("button,input")).toBeNull()
})

it("exports read-only code without the copy SVG, textarea or raw fence markers", () => {
  const root = document.createElement("div")
  root.innerHTML = '<div data-type="code-block" class="vditor-ir__node"><span data-type="code-block-open-marker">```JS</span><pre class="vditor-ir__marker"><code class="language-JS">if (ready) {\n    return &lt;value&gt;\n}\n</code></pre><pre class="vditor-ir__preview vessel-code-frame"><div class="vditor-copy"><textarea></textarea><span><svg viewBox="0 0 24 24"><path d="M0 0h24v24" /></svg></span></div><code><span class="hljs-keyword">wrong preview</span></code><span style="position:absolute">cursor</span></pre><span data-type="code-block-close-marker">```</span></div>'
  const exported = new DOMParser().parseFromString(printableMarkdown(root), "text/html")
  expect(exported.querySelectorAll("pre")).toHaveLength(1)
  expect(exported.querySelector("pre code")?.textContent).toBe("if (ready) {\n    return <value>\n}\n")
  expect(exported.querySelector("textarea,svg,.vditor-copy,[data-type=code-block-open-marker]")).toBeNull()
  expect(exported.body.textContent).not.toMatch(/```|wrong preview|cursor/)
  expect(exported.title).toBe("Vessel 文档")
})
