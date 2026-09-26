import React from "react"
import { readFileSync } from "node:fs"
import { createRequire } from "node:module"
import { renderToStaticMarkup } from "react-dom/server"
import { Bold } from "lucide-react"
import { expect, it } from "vitest"

it("keeps Lucide toolbar strokes visible alongside Vditor's sprite icons", () => {
  const require = createRequire(import.meta.url)
  const style = document.createElement("style")
  style.textContent = readFileSync(require.resolve("vditor/dist/index.css"), "utf8") + readFileSync("src/renderer/src/components/core/canvas/variants/markdown/index.css", "utf8")
  const host = document.createElement("div")
  host.className = "vessel-vditor vditor"
  host.innerHTML = '<div class="vditor-toolbar"><div class="vditor-toolbar__item"><button>' + renderToStaticMarkup(<Bold />) + '<svg class="sprite"><use href="#icon"></use></svg></button></div></div>'
  document.head.append(style)
  document.body.append(host)
  try {
    const icon = host.querySelector("svg.lucide")!
    expect(Number.parseFloat(getComputedStyle(icon).strokeWidth)).toBeGreaterThan(0)
    expect(["none", "rgba(0, 0, 0, 0)"]).toContain(getComputedStyle(icon).fill)
    expect(["none", "rgba(0, 0, 0, 0)"]).not.toContain(getComputedStyle(host.querySelector("svg.sprite")!).fill)
  } finally {
    host.remove()
    style.remove()
  }
})
