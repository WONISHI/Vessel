import { createRequire } from "node:module"
import { expect, it } from "vitest"
import { clipboardMathMarkdown, normalizeClipboardMath } from "@/components/core/canvas/variants/markdown/math-paste"
createRequire(import.meta.url)("vditor/dist/js/lute/lute.min.js")
const lute = (globalThis as any).Lute.New()
lute.SetInlineMathAllowDigitAfterOpenMarker(true)
const convert = (html: string) => lute.HTML2Md(html)
const katex = (source: string) => `<span class="katex"><span class="katex-mathml"><math><semantics><mi>duplicate</mi><annotation encoding="application/x-tex">${source}</annotation></semantics></math></span><span class="katex-html">duplicate</span></span>`
it("recovers source-bearing wrappers even when clipboard HTML strips internal KaTeX annotations", () => {
  const source = "00000101\\;\\to\\;00001010=10"
  const html = `<div class="math-display" data-latex="${source}"><span>00000101→00001010=10</span><span>${source}</span><span>00000101→00001010=10</span></div><p>乘以 <span class="math-inline" data-tex="2^n">2n2^n2n</span></p>`
  const markdown = clipboardMathMarkdown(html, convert)!
  expect(markdown.match(/00000101/g)).toHaveLength(1)
  expect(markdown).toContain(`$$\n${source}\n$$`)
  expect(markdown).toContain("$2^n$")
  expect(markdown).not.toContain("2n2^n2n")
})
it("normalizes plain LaTeX delimiters but preserves inline and fenced code", () => {
  expect(normalizeClipboardMath('公式 \\(2^n\\)\n\\[00000101\\to00001010=10\\]')).toContain('$2^n$\n\n\n$$\n00000101\\to00001010=10\n$$')
  const code = '`\\(2^n\\)`\n```tex\n\\[x^2\\]\n```'
  expect(normalizeClipboardMath(code)).toBe(code)
})

it("recovers inline and display LaTeX exactly once while preserving surrounding formatting", () => {
  const markdown = clipboardMathMarkdown(`<p><strong>因为</strong> ${katex("8 = 2^3")}：三位。</p><div class="katex-display">${katex("110101_2 = 65_8")}</div><p>结束</p>`, convert)!
  expect(markdown).toContain("**因为** $8 = 2^3$：三位。")
  expect(markdown).toContain("$$\n110101_2 = 65_8\n$$")
  expect(markdown).not.toContain("duplicate")
  expect(markdown.match(/110101/g)).toHaveLength(1)
  expect(lute.Md2VditorIRDOM(markdown)).toContain("math-block")
  expect(lute.Md2VditorIRDOM(markdown)).toContain("math-inline")
})

it("leaves ordinary HTML and formulas without recoverable source on the native paste path", () => {
  expect(clipboardMathMarkdown("<p>8=238</p>", convert)).toBeNull()
  expect(clipboardMathMarkdown('<math><mi>x</mi></math>', convert)).toBeNull()
  expect(clipboardMathMarkdown(`<pre><code>${katex("x^2")}</code></pre>`, convert)).toBeNull()
})

it("supports source-bearing MathJax, MathML and data-math clipboard markup", () => {
  expect(clipboardMathMarkdown('<mjx-container display="true"><math><annotation encoding="application/x-tex">x^2</annotation></math></mjx-container>', convert)).toContain("$$\nx^2\n$$")
  expect(clipboardMathMarkdown('<span data-math="a_1">visual</span>', convert)).toContain("$a_1$")
})
