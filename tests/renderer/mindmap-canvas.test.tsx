import { act, cleanup, render, screen, waitFor } from "@testing-library/react"
import { afterEach, expect, it, vi } from "vitest"
import MindmapCanvas from "@/components/core/canvas/variants/mindmap"

const state = vi.hoisted(() => ({ editors: [] as any[] }))
vi.mock("mind-elixir", () => ({ default: class {
  static DARK_THEME = { name: "dark" }; static THEME = { name: "light" }
  data: any
  listeners: Record<string, Function> = {}
  bus = { addListener: (name: string, handler: Function) => { this.listeners[name] = handler } }
  destroy = vi.fn(); undo = vi.fn(); redo = vi.fn(); changeTheme = vi.fn()
  constructor() { state.editors.push(this) }
  init(data: any) { this.data = data }
  getData() { return this.data }
} }))
afterEach(() => { cleanup(); state.editors.length = 0; vi.restoreAllMocks() })

it("flushes the last unsaved node edit when the file editor closes", async () => {
  const save = vi.fn(async () => {})
  Object.defineProperty(window, "electronAPI", { configurable: true, value: {
    readContent: vi.fn(async () => '{"nodeData":{"id":"root","topic":"原主题"}}'), saveContent: save
  } })
  const view = render(<MindmapCanvas activeFilePath="/vault/test.mind" />)
  await waitFor(() => expect(screen.getByRole("button", { name: "保存" }).hasAttribute("disabled")).toBe(false))
  act(() => { state.editors[0].data.nodeData.topic = "未等待防抖的修改"; state.editors[0].listeners.operation({ name: "finishEdit" }) })
  view.unmount()
  await waitFor(() => expect(save).toHaveBeenCalled())
  expect(JSON.parse(save.mock.calls[0][1]).nodeData.topic).toBe("未等待防抖的修改")
})
it("reports invalid files without initializing the canvas or overwriting data", async () => {
  const save = vi.fn()
  Object.defineProperty(window, "electronAPI", { configurable: true, value: { readContent: vi.fn(async () => 'invalid document'), saveContent: save } })
  render(<MindmapCanvas activeFilePath="/vault/broken.mind" />)
  expect(await screen.findByRole("alert")).toBeTruthy()
  expect(state.editors).toHaveLength(0)
  expect(save).not.toHaveBeenCalled()
})
