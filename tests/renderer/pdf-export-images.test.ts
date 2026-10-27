import { afterEach, expect, it, vi } from "vitest"
import { pdfDocumentHtml } from "@/components/pdf-export/export-html"
afterEach(() => vi.unstubAllGlobals())

it("resolves lazy attachments from their source rather than printing a loading placeholder", async () => {
  const read = vi.fn().mockResolvedValue("data:image/png;base64,actual")
  vi.stubGlobal("electronAPI", { readObsidianImage: read })
  const root = document.createElement("div")
  const block = document.createElement("div")
  block.className = "vessel-image-block"
  const pre = document.createElement("pre")
  pre.className = "vditor-ir__marker"
  const code = document.createElement("code")
  code.textContent = encodeURIComponent("![[assets/示例.png|320]]")
  pre.append(code)
  block.append(pre)
  const loading = document.createElement("pre")
  loading.className = "vditor-ir__preview"
  loading.innerHTML = '<img src="loading.svg">'
  block.append(loading)
  root.append(block)
  const output = new DOMParser().parseFromString(await pdfDocumentHtml(root, "/vault", "/vault/test.md"), "text/html")
  expect(read).toHaveBeenCalledWith("/vault", "/vault/test.md", "![[assets/示例.png|320]]")
  expect(output.querySelector("img")?.getAttribute("src")).toBe("data:image/png;base64,actual")
  expect(output.querySelector("img")?.style.width).toBe("320px")
  expect(output.body.innerHTML).not.toContain("loading.svg")
})
