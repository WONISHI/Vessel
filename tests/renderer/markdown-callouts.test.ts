import { createRequire } from "node:module"
import { expect, it } from "vitest"
import { parseCalloutHeader } from "@vessel/obsidian"
import { decorateCallouts, bindCallouts, changeCalloutType } from "@/components/core/canvas/variants/markdown/callouts"
createRequire(import.meta.url)("vditor/dist/js/lute/lute.min.js")
it("inserts the first empty-title character after the directive even when the native caret is beside the heading", () => {
  const root = document.createElement("div")
  root.contentEditable = "true"; root.setAttribute("contenteditable", "true")
  root.innerHTML = '<blockquote><p>[!help]+</p></blockquote>'
  document.body.append(root)
  decorateCallouts(root)
  const unbind = bindCallouts(root)
  try {
    const heading = root.querySelector<HTMLElement>(".vessel-callout-heading")!
    heading.dispatchEvent(new MouseEvent("dblclick", { bubbles: true, cancelable: true }))
    const paragraph = heading.parentElement!
    const range = document.createRange()
    range.setStart(paragraph, 0); range.collapse(true)
    getSelection()!.removeAllRanges(); getSelection()!.addRange(range)
    const input = new InputEvent("beforeinput", { bubbles: true, cancelable: true, inputType: "insertText", data: "z" })
    root.dispatchEvent(input)
    expect(input.defaultPrevented).toBe(true)
    expect(root.querySelector(".vessel-callout")).toBeTruthy()
    expect(heading.dataset.calloutTitle).toBe("z")
    expect(lute.VditorIRDOM2Md(root.innerHTML)).toContain("[!help]+ z")
    expect(root.textContent).not.toContain("z[!help]")
  } finally { unbind(); root.remove() }
})
const lute = (globalThis as any).Lute.New()
it("parses aliases, empty titles and fold markers without accepting ordinary quotes", () => {
  expect(parseCalloutHeader("[!caution]- 标题")).toEqual({ type: "warning", name: "caution", title: "标题", foldable: true, expanded: false })
  expect(parseCalloutHeader("[!NOTE]+")).toMatchObject({ type: "note", title: "", expanded: true })
  expect(parseCalloutHeader("[!custom] title")).toMatchObject({ type: "note", name: "custom" })
  expect(parseCalloutHeader("普通引用")).toBeNull()
  expect(parseCalloutHeader("[!note]title")).toBeNull()
})
it("renders nested callouts and toggles folds without changing serialized Markdown", () => {
  const source = '> [!note]- **标题**\n> 正文 **加粗**\n>\n> > [!warning] 内层\n> > body\n\n> 普通引用\n'
  const root = document.createElement("div")
  root.innerHTML = lute.Md2VditorIRDOM(source)
  document.body.append(root)
  const before = lute.VditorIRDOM2Md(root.innerHTML)
  const unbind = bindCallouts(root)
  try {
    decorateCallouts(root)
    expect(root.querySelectorAll(".vessel-callout")).toHaveLength(2)
    const heading = root.querySelector<HTMLElement>(".vessel-callout-heading")!
    expect(heading.dataset.calloutTitle).toBe("标题")
    expect(heading.getAttribute("aria-expanded")).toBe("false")
    expect(lute.VditorIRDOM2Md(root.innerHTML)).toBe(before)
    heading.click()
    expect(heading.getAttribute("aria-expanded")).toBe("true")
    decorateCallouts(root)
    expect(heading.getAttribute("aria-expanded")).toBe("true")
    expect(lute.VditorIRDOM2Md(root.innerHTML)).toBe(before)
  } finally { unbind(); root.remove() }
})
it("supports keyboard folding, recognizes empty titles and removes styling when the directive is deleted", () => {
  const root = document.createElement("div")
  root.innerHTML = lute.Md2VditorIRDOM('> [!tip]+\n> body\n')
  const unbind = bindCallouts(root)
  try {
    decorateCallouts(root)
    const quote = root.querySelector("blockquote")!
    const heading = root.querySelector<HTMLElement>(".vessel-callout-heading")!
    expect(heading.dataset.calloutTitle).toBe("")
    heading.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }))
    expect(quote.classList.contains("vessel-callout-collapsed")).toBe(true)
    heading.textContent = "ordinary quote"
    decorateCallouts(root)
    expect(quote.classList.contains("vessel-callout")).toBe(false)
    expect(root.querySelector(".vessel-callout-heading")).toBeNull()
    expect(root.textContent).toContain("ordinary quote")
  } finally { unbind() }
})

it("interprets legacy pencil-prefixed fold markers without persisting display cleanup", () => {
  for (const flag of ["-", "+"]) {
    const root = document.createElement("div")
    root.innerHTML = lute.Md2VditorIRDOM(`> [!NOTE] ✏️ ${flag} 软件的生命周期\n> 正文\n`)
    const before = lute.VditorIRDOM2Md(root.innerHTML)
    decorateCallouts(root)
    const heading = root.querySelector<HTMLElement>(".vessel-callout-heading")!
    expect(heading.dataset.calloutTitle).toBe("软件的生命周期")
    expect(heading.getAttribute("aria-expanded")).toBe(String(flag === "+"))
    expect(lute.VditorIRDOM2Md(root.innerHTML)).toBe(before)
  }
  expect(parseCalloutHeader("[!note] ✏️ 普通标题")?.title).toBe("普通标题")
  expect(parseCalloutHeader("[!note] 软件-v2")?.title).toBe("软件-v2")
})

it("hides tight and formatted title fold markers and applies their default state", () => {
  for (const [header, expanded] of [
    ["[!NOTE] ✏️-软件生命周期", false],
    ["[!note] -软件生命周期", false],
    ["[!note] **- 软件生命周期**", false],
    ["[!note] ✏️ **+ 软件生命周期**", true],
    ["[!note]- 软件生命周期", false]
  ] as const) {
    const root = document.createElement("div")
    root.innerHTML = lute.Md2VditorIRDOM(`> ${header}\n> 正文\n`)
    const original = lute.VditorIRDOM2Md(root.innerHTML)
    decorateCallouts(root)
    const heading = root.querySelector<HTMLElement>(".vessel-callout-heading")!
    expect(heading.dataset.calloutTitle).toBe("软件生命周期")
    expect(heading.getAttribute("aria-expanded")).toBe(String(expanded))
    expect(lute.VditorIRDOM2Md(root.innerHTML)).toBe(original)
  }
})

it("keeps imported pencil decoration hidden when the source title enters edit mode", () => {
  const root = document.createElement("div")
  root.contentEditable = "true"
  root.setAttribute("contenteditable", "true")
  root.innerHTML = lute.Md2VditorIRDOM('> [!NOTE] ✏️ - 软件的生命周期\n> 正文\n')
  document.body.append(root)
  const original = lute.VditorIRDOM2Md(root.innerHTML)
  const unbind = bindCallouts(root)
  try {
    decorateCallouts(root)
    const heading = root.querySelector<HTMLElement>(".vessel-callout-heading")!
    heading.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }))
    expect(heading.classList.contains("vessel-callout-editing")).toBe(true)
    expect(heading.querySelector("[data-callout-decoration]")?.textContent).toBe("✏️ - ")
    expect(heading.dataset.calloutTitle).toBe("软件的生命周期")
    expect(lute.VditorIRDOM2Md(root.innerHTML)).toBe(original)
    decorateCallouts(root)
    expect(heading.querySelectorAll("[data-callout-decoration]")).toHaveLength(1)
  } finally { unbind(); window.getSelection()?.removeAllRanges(); root.remove() }
})

it("opens type selection only from the icon and changes only the source type", () => {
  const root = document.createElement("div")
  root.innerHTML = lute.Md2VditorIRDOM('> [!NOTE] ✏️ - 标题\n> 正文 **保留**\n')
  decorateCallouts(root)
  const before = lute.VditorIRDOM2Md(root.innerHTML)
  let requested: HTMLElement | undefined
  const unbind = bindCallouts(root, ({ quote }) => { requested = quote })
  const heading = root.querySelector<HTMLElement>(".vessel-callout-heading")!
  try {
    heading.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: 40 }))
    expect(requested).toBeUndefined()
    const event = new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: 5, clientY: 10 })
    heading.dispatchEvent(event)
    expect(event.defaultPrevented).toBe(true)
    expect(requested).toBe(root.querySelector("blockquote"))
    // Preserve an explicitly expanded presentation of a source-default collapsed callout.
    heading.click()
    expect(heading.getAttribute("aria-expanded")).toBe("true")
    expect(changeCalloutType(requested!, "caution")).toBe(true)
    expect(requested!.dataset.calloutType).toBe("warning")
    expect(heading.dataset.calloutTitle).toBe("标题")
    expect(heading.getAttribute("aria-expanded")).toBe("true")
    expect(lute.VditorIRDOM2Md(root.innerHTML)).toBe(before.replace("[!NOTE]", "[!caution]"))
  } finally { unbind() }
})

it("opens the block menu from the whole callout and targets the nearest nested callout", () => {
  const root = document.createElement("div")
  root.innerHTML = lute.Md2VditorIRDOM('> [!note] 外层\n> 正文\n>\n> > [!warning] 内层\n> > 内层正文\n')
  decorateCallouts(root)
  let selected: HTMLElement | undefined
  const unbind = bindCallouts(root, undefined, ({ quote }) => { selected = quote })
  const fallback = () => { throw new Error("must not open the generic insert menu") }
  root.addEventListener("contextmenu", fallback, true)
  try {
    const quotes = root.querySelectorAll<HTMLElement>(".vessel-callout")
    const event = new MouseEvent("contextmenu", { bubbles: true, cancelable: true, clientX: 100 })
    quotes[0].dispatchEvent(event)
    expect(selected).toBe(quotes[0])
    expect(event.defaultPrevented).toBe(true)
    quotes[1].querySelector("p")!.dispatchEvent(new MouseEvent("contextmenu", { bubbles: true, clientX: 100 }))
    expect(selected).toBe(quotes[1])
  } finally { unbind(); root.removeEventListener("contextmenu", fallback, true) }
})

it("retains an empty title's directive and keeps the right-edge disclosure usable during editing", () => {
  const root = document.createElement("div")
  root.setAttribute("contenteditable", "true")
  root.innerHTML = lute.Md2VditorIRDOM('> [!help]+ 标题\n> 标注内容\n')
  document.body.append(root)
  decorateCallouts(root)
  const unbind = bindCallouts(root)
  try {
    const quote = root.querySelector<HTMLElement>("blockquote")!
    const heading = root.querySelector<HTMLElement>(".vessel-callout-heading")!
    heading.classList.add("vessel-callout-editing")
    const title = heading.lastChild as Text
    title.data = ""
    decorateCallouts(root)
    expect(heading.dataset.calloutTitle).toBe("")
    expect(heading.querySelector("[data-callout-marker]")?.textContent).toBe("[!help]+ ")
    expect(lute.VditorIRDOM2Md(root.innerHTML)).toContain("[!help]+")
    root.focus()
    const range = document.createRange()
    range.setStart(title, 0); range.collapse(true)
    window.getSelection()?.removeAllRanges(); window.getSelection()?.addRange(range)
    const backspace = new KeyboardEvent("keydown", { key: "Backspace", bubbles: true, cancelable: true })
    root.dispatchEvent(backspace)
    expect(backspace.defaultPrevented).toBe(true)
    quote.getBoundingClientRect = () => ({ top: 0, right: 400, left: 0, bottom: 100, width: 400, height: 100 } as DOMRect)
    heading.dispatchEvent(new MouseEvent("click", { bubbles: true, clientX: 385, clientY: 20 }))
    expect(heading.getAttribute("aria-expanded")).toBe("false")
    expect(root.textContent).toContain("标注内容")
  } finally { unbind(); root.remove(); window.getSelection()?.removeAllRanges() }
})

it.each([true, false])("keeps Enter in the editor and focuses the callout body, existing body=%s", (hasBody) => {
  const root = document.createElement("div")
  root.setAttribute("contenteditable", "true")
  root.innerHTML = lute.Md2VditorIRDOM(`> [!note]+ 标题${hasBody ? "\n> 正文" : ""}\n`)
  document.body.append(root)
  decorateCallouts(root)
  const before = lute.VditorIRDOM2Md(root.innerHTML)
  const unbind = bindCallouts(root)
  try {
    const heading = root.querySelector<HTMLElement>(".vessel-callout-heading")!
    heading.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }))
    expect(document.activeElement).toBe(root)
    const composing = new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true, isComposing: true })
    root.dispatchEvent(composing)
    expect(composing.defaultPrevented).toBe(false)
    const enter = new KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true })
    root.dispatchEvent(enter)
    expect(enter.defaultPrevented).toBe(true)
    expect(document.activeElement).toBe(root)
    expect(root.contains(window.getSelection()!.anchorNode)).toBe(true)
    expect(heading.contains(window.getSelection()!.anchorNode)).toBe(false)
    expect(heading.classList.contains("vessel-callout-editing")).toBe(false)
    expect(heading.getAttribute("aria-expanded")).toBe("true")
    expect(lute.VditorIRDOM2Md(root.innerHTML)).toContain("[!note]+ 标题")
    if (hasBody) {
      expect(lute.VditorIRDOM2Md(root.innerHTML)).toBe(before)
      expect(window.getSelection()!.anchorNode!.textContent!.slice(window.getSelection()!.anchorOffset)).toBe("正文")
    } else expect(root.querySelectorAll("blockquote > p")).toHaveLength(2)
  } finally { unbind(); root.remove(); window.getSelection()?.removeAllRanges() }
})

it.each([
  ["标题", "Delete", 0, "题"],
  ["标题", "Delete", 2, "标题"],
  ["标题", "Backspace", 2, "标"],
  ["标题", "Backspace", 0, "标题"],
  ["标👨‍👩‍👧‍👦题", "Delete", 1, "标题"]
] as const)("deletes title text locally and retains focus: %s %s at %s", (text, key, offset, expected) => {
  const root = document.createElement("div")
  root.setAttribute("contenteditable", "true")
  root.innerHTML = lute.Md2VditorIRDOM(`> [!note]+ ${text}\n> 正文\n`)
  document.body.append(root)
  decorateCallouts(root)
  let persisted = ""
  const unbind = bindCallouts(root, undefined, undefined, (apply) => { apply(); persisted = lute.VditorIRDOM2Md(root.innerHTML) })
  try {
    const heading = root.querySelector<HTMLElement>(".vessel-callout-heading")!
    const title = heading.lastChild as Text
    root.focus()
    const range = document.createRange()
    range.setStart(title, offset); range.collapse(true)
    window.getSelection()?.removeAllRanges(); window.getSelection()?.addRange(range)
    const event = new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true })
    root.dispatchEvent(event)
    expect(event.defaultPrevented).toBe(true)
    expect(document.activeElement).toBe(root)
    expect(heading.contains(window.getSelection()!.anchorNode)).toBe(true)
    expect(heading.dataset.calloutTitle).toBe(expected)
    expect(persisted).toContain(`[!note]+ ${expected}`)
    expect(persisted).toContain("正文")
  } finally { unbind(); root.remove(); window.getSelection()?.removeAllRanges() }
})

it("deleting the selected entire title retains its directive, caret and body", () => {
  const root = document.createElement("div")
  root.setAttribute("contenteditable", "true")
  root.innerHTML = lute.Md2VditorIRDOM('> [!note]+ 标题\n> 正文\n')
  document.body.append(root)
  decorateCallouts(root)
  const unbind = bindCallouts(root)
  try {
    const heading = root.querySelector<HTMLElement>(".vessel-callout-heading")!
    root.focus()
    const range = document.createRange()
    range.selectNodeContents(heading)
    window.getSelection()?.removeAllRanges(); window.getSelection()?.addRange(range)
    root.dispatchEvent(new KeyboardEvent("keydown", { key: "Delete", bubbles: true, cancelable: true }))
    expect(document.activeElement).toBe(root)
    expect(heading.contains(window.getSelection()!.anchorNode)).toBe(true)
    expect(heading.dataset.calloutTitle).toBe("")
    expect(lute.VditorIRDOM2Md(root.innerHTML)).toContain("[!note]+")
    expect(lute.VditorIRDOM2Md(root.innerHTML)).toContain("正文")
  } finally { unbind(); root.remove(); window.getSelection()?.removeAllRanges() }
})

it("inserts spaces, text and replacements inside the title without invoking Vditor key handlers", () => {
  const root = document.createElement("div")
  root.setAttribute("contenteditable", "true")
  root.innerHTML = lute.Md2VditorIRDOM('> [!note]+ 标题\n> 正文\n')
  document.body.append(root)
  decorateCallouts(root)
  const unbind = bindCallouts(root)
  let nativeSpace = false
  const nativeKey = () => { nativeSpace = true }
  root.addEventListener("keydown", nativeKey)
  try {
    const heading = root.querySelector<HTMLElement>(".vessel-callout-heading")!
    heading.dispatchEvent(new MouseEvent("dblclick", { bubbles: true }))
    root.dispatchEvent(new KeyboardEvent("keydown", { key: " ", bubbles: true, cancelable: true }))
    expect(nativeSpace).toBe(false)
    for (const text of [" ", "hello", " ", "world"]) {
      const event = new InputEvent("beforeinput", { inputType: "insertText", data: text, bubbles: true, cancelable: true })
      root.dispatchEvent(event)
      expect(event.defaultPrevented).toBe(true)
      expect(document.activeElement).toBe(root)
      expect(heading.contains(window.getSelection()!.anchorNode)).toBe(true)
    }
    expect(heading.dataset.calloutTitle).toBe("标题 hello world")
    expect(lute.VditorIRDOM2Md(root.innerHTML)).toContain("[!note]+ 标题 hello world")
  } finally { unbind(); root.remove(); window.getSelection()?.removeAllRanges() }
})

it("keeps the fold flag hidden and protected when Vditor splits the directive across inline markers", () => {
  const root = document.createElement("div")
  root.setAttribute("contenteditable", "true")
  root.innerHTML = '<blockquote><p><span class="vditor-ir__marker">[!note] </span>+ 标题\n正文</p></blockquote>'
  document.body.append(root)
  decorateCallouts(root)
  const unbind = bindCallouts(root)
  try {
    const heading = root.querySelector<HTMLElement>(".vessel-callout-heading")!
    expect(heading.querySelector("[data-callout-marker]")?.textContent).toBe("[!note] + ")
    root.focus()
    const range = document.createRange()
    range.setStart(heading.lastChild!, 0); range.collapse(true)
    window.getSelection()?.removeAllRanges(); window.getSelection()?.addRange(range)
    root.dispatchEvent(new KeyboardEvent("keydown", { key: "Delete", bubbles: true, cancelable: true }))
    expect(heading.dataset.calloutTitle).toBe("题")
    expect(heading.textContent).toContain("[!note] + ")
    expect(document.activeElement).toBe(root)
  } finally { unbind(); root.remove(); window.getSelection()?.removeAllRanges() }
})
