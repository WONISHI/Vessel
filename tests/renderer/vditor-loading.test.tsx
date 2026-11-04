import { markdownDocuments } from "@/components/native-file-menu/document-bridge"
vi.mock("@vessel/react-router", () => ({ useRouter: () => ({ push: vi.fn() }) }))
import React from "react"
import { act, cleanup, render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
const state = vi.hoisted(() => ({ after: undefined as undefined | (() => void), created: vi.fn(), destroy: vi.fn(), disabled: vi.fn(), liveSource: undefined as string | undefined, options: undefined as undefined | { toolbar: unknown[]; input: (value: string) => void } }))
vi.mock("vditor", () => ({
  default: class {
    value: string
    getValue() { return state.liveSource ?? this.value }
    constructor(_element: HTMLElement, options: { value: string; after: () => void; toolbar: unknown[]; input: (value: string) => void }) {
      this.value = options.value
      state.created()
      state.after = options.after
      state.options = options
    }
    disabled() {
      state.disabled()
    }
    destroy() {
      state.destroy()
    }
  }
}))
import { VditorEditor } from "@/components/core/canvas/variants/markdown/vditor-editor"
beforeEach(() => { state.liveSource = undefined; vi.stubGlobal("ResizeObserver", class { observe() {} disconnect() {} unobserve() {} }) })
afterEach(() => { cleanup(); vi.unstubAllGlobals() })
it("paints document loading before initialization and dismisses it only when the editor is ready", async () => {
  render(
    <VditorEditor
      value="# 文档"
      onChange={() => {}}
      workspacePath="/notes"
      documentPath="/notes/test.md"
    />
  )
  expect(screen.getByRole("status").textContent).toContain("正在解析")
  expect(state.created).not.toHaveBeenCalled()
  await waitFor(() => expect(state.created).toHaveBeenCalledTimes(1))
  expect(screen.getByRole("status")).toBeTruthy()
  act(() => state.after?.())
  await waitFor(() => expect(screen.queryByRole("status")).toBeNull())
})

it("uses the same renderer with no toolbar and suppresses writes in read-only previews", async () => {
  const change = vi.fn()
  state.created.mockClear()
  render(
    <VditorEditor
      readOnly
      value="# Preview"
      onChange={change}
      workspacePath="/notes"
      documentPath="/notes/test.md"
    />
  )
  await waitFor(() => expect(state.created).toHaveBeenCalledTimes(1))
  expect(state.options?.toolbar).toEqual([])
  act(() => state.after?.())
  expect(state.disabled).toHaveBeenCalled()
  act(() => state.options?.input("changed"))
  expect(change).not.toHaveBeenCalled()
  expect(screen.queryByLabelText("当前文件路径")).toBeNull()
})

it("decorates changed paragraphs without traversing unrelated paragraphs", async () => {
  state.created.mockClear()
  const { container } = render(<VditorEditor readOnly value="paragraphs" onChange={() => {}} workspacePath="/notes" documentPath="/notes/test.md" />)
  await waitFor(() => expect(state.created).toHaveBeenCalledTimes(1))
  act(() => state.after?.())
  await waitFor(() => expect(screen.queryByRole("status")).toBeNull())
  const host = container.querySelector(".vditor") || container.querySelector(".vessel-vditor")!
  const ir = document.createElement("div")
  ir.className = "vditor-ir"
  ir.innerHTML = '<div class="vditor-reset"><p>unchanged</p><p>changed</p></div>'
  act(() => host.append(ir))
  await new Promise((resolve) => setTimeout(resolve, 60))
  const paragraphs = ir.querySelectorAll("p")
  const walker = vi.spyOn(document, "createTreeWalker")
  try {
    act(() => { paragraphs[1].firstChild!.textContent = "[[target]]" })
    await waitFor(() => expect(paragraphs[1].querySelector('[data-wiki-target="target"]')).toBeTruthy())
    expect(walker.mock.calls.some(([root]) => root === paragraphs[0] || root === ir.querySelector(".vditor-reset"))).toBe(false)
    expect(walker.mock.calls.some(([root]) => root === paragraphs[1])).toBe(true)
  } finally { walker.mockRestore() }
})

it("flushes edits made before Vditor's delayed input callback when an editor is evicted", async () => {
  state.created.mockClear()
  const save = vi.fn().mockResolvedValue(undefined)
  window.electronAPI = { saveContent: save } as any
  const { unmount } = render(<VditorEditor value="original" onChange={vi.fn()} workspacePath="/notes" documentPath="/notes/evicted.md" />)
  await waitFor(() => expect(state.created).toHaveBeenCalledTimes(1))
  act(() => state.after?.())
  state.liveSource = "last unsent edit"
  unmount()
  expect(save).toHaveBeenCalledWith("/notes/evicted.md", "last unsent edit")
})

it("does not register a destroyed editor when initialization completes after eviction", async () => {
  state.created.mockClear(); state.destroy.mockClear()
  const path = "/notes/late-ready.md"
  const { unmount } = render(<VditorEditor value="text" onChange={vi.fn()} workspacePath="/notes" documentPath={path} />)
  await waitFor(() => expect(state.created).toHaveBeenCalledTimes(1))
  unmount()
  act(() => state.after?.())
  expect(state.destroy).toHaveBeenCalledOnce()
  expect(markdownDocuments.has(path)).toBe(false)
})
