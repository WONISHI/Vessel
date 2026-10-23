import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
const state = vi.hoisted(() => ({ insertMD: vi.fn(), setValue: vi.fn(), created: vi.fn(), editable: null as HTMLElement | null, source: "正文" }))
vi.mock("@vessel/react-router", () => ({ useRouter: () => ({ push: vi.fn() }) }))
vi.mock("@/components/core/canvas/variants/markdown/obsidian-images", () => ({ ObsidianImageLine: ({ source }: { source: string }) => <div data-testid="image-component">{source}</div> }))
vi.mock("vditor", () => ({
  default: class {
    vditor = { undo: { addToUndoStack: vi.fn() } }
    constructor(host: HTMLElement, options: any) {
      state.created()
      host.innerHTML = '<div class="vditor-toolbar"></div><div class="vditor-ir"><pre class="vditor-reset" contenteditable="true"><p>正文</p></pre></div>'
      state.editable = host.querySelector('[contenteditable="true"]')!
      state.source = "正文"
      state.insertMD.mockImplementation((markdown: string) => {
        state.source += "\n" + markdown
        const encoded = /```vessel-obsidian-image\n([^\n]+)/.exec(markdown)?.[1]
        if (!encoded) return
        const block = document.createElement("div")
        block.dataset.type = "code-block"
        block.innerHTML = '<pre class="vditor-ir__marker"><code class="language-vessel-obsidian-image"></code></pre><pre class="vditor-ir__preview"><code class="language-vessel-obsidian-image"></code></pre>'
        block.querySelectorAll("code").forEach((code) => {
          code.textContent = encoded
        })
        state.editable!.append(block)
        // Reproduce Vditor inserting a code preview without running the custom renderer yet.
      })
      queueMicrotask(() => options.after())
    }
    insertMD = state.insertMD
    setValue = state.setValue
    getValue() {
      return state.source
    }
    destroy() {}
  }
}))
import { VditorEditor } from "@/components/core/canvas/variants/markdown/vditor-editor"
beforeEach(() => {
  vi.stubGlobal(
    "ResizeObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  )
  state.editable = null
  state.insertMD.mockClear()
  state.setValue.mockClear()
  state.created.mockClear()
  Object.defineProperty(window, "electronAPI", { configurable: true, value: { saveObsidianImage: vi.fn(async () => ({ reference: "![[Pasted image.png]]" })) } })
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})
async function openEditor() {
  const change = vi.fn()
  render(
    <VditorEditor
      value="正文"
      workspacePath="/vault"
      documentPath="/vault/note.md"
      onChange={change}
    />
  )
  await waitFor(() => expect(state.editable).not.toBeNull())
  await waitFor(() => expect(screen.queryByText("正在加载编辑器…")).toBeNull())
  const range = document.createRange()
  range.selectNodeContents(state.editable!.querySelector("p")!)
  range.collapse(false)
  window.getSelection()?.removeAllRanges()
  window.getSelection()?.addRange(range)
  return change
}

it("mounts the image component immediately after a text reference paste without a document reload", async () => {
  const change = await openEditor()
  await act(async () => {
    fireEvent.paste(state.editable!, { clipboardData: { files: [], getData: () => "![[Pasted image.png]]" } })
  })
  expect(await screen.findByTestId("image-component")).toHaveProperty("textContent", "![[Pasted image.png]]")
  await waitFor(() => expect(change).toHaveBeenCalledWith(expect.stringContaining("![[Pasted image.png]]")))
  expect(state.setValue).not.toHaveBeenCalled()
  expect(state.created).toHaveBeenCalledTimes(1)
  expect(document.querySelectorAll(".vessel-image-component")).toHaveLength(1)
})

it("mounts a clipboard image after attachment saving without rendering its encoded source", async () => {
  await openEditor()
  const image = new File(["pixels"], "clipboard.png", { type: "image/png" })
  Object.defineProperty(image, "arrayBuffer", { value: async () => new ArrayBuffer(2) })
  await act(async () => {
    fireEvent.paste(state.editable!, { clipboardData: { files: [image], getData: () => "" } })
  })
  expect(await screen.findByTestId("image-component")).toBeTruthy()
  expect(window.electronAPI.saveObsidianImage).toHaveBeenCalled()
  expect(state.editable!.querySelector(".vditor-ir__preview")?.textContent).not.toContain("%5B")
  expect(state.setValue).not.toHaveBeenCalled()
})
