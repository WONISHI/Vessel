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
