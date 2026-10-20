import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, expect, it, vi } from "vitest"
import MindmapCanvas from "@/components/core/canvas/variants/mindmap"

const state = vi.hoisted(() => ({ editors: [] as any[] }))
vi.mock("mind-elixir", () => ({ default: class {
  static DARK_THEME = { name: "dark" }; static THEME = { name: "light" }
  data: any
  currentNode: any = null
  findEle = vi.fn(() => ({ nodeObj: this.data.nodeData }))
  selectNode = vi.fn((node: any) => { this.currentNode = node })
  addChild = vi.fn(async (node: any) => {
    const child = { id: `child-${Math.random()}`, topic: "分支主题" }
    ;(node.nodeObj.children ||= []).push(child)
    this.currentNode = { nodeObj: child }
    this.listeners.selectNewNode?.(child)
    this.listeners.operation?.({ name: "addChild" })
  })
  insertSibling = vi.fn(async () => {})
  insertParent = vi.fn(async () => {})
  copyNode = vi.fn(async () => {})
  moveUpNode = vi.fn(async () => {})
  moveDownNode = vi.fn(async () => {})
  expandNode = vi.fn()
  expandNodeAll = vi.fn()
  reshapeNode = vi.fn(async () => {})
  focusNode = vi.fn()
  cancelFocus = vi.fn()
  initLeft = vi.fn()
  initRight = vi.fn()
  initSide = vi.fn()
  beginEdit = vi.fn(async () => {})
  removeNodes = vi.fn(async () => {})
  listeners: Record<string, Function> = {}
  bus = { addListener: (name: string, handler: Function) => { this.listeners[name] = handler } }
  destroy = vi.fn(); undo = vi.fn(); redo = vi.fn(); changeTheme = vi.fn()
  options: any
  constructor(options: any) { this.options = options; state.editors.push(this) }
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

it("adds multiple levels of child topics and saves the resulting editable tree", async () => {
  const save = vi.fn(async () => {})
  Object.defineProperty(window, "electronAPI", { configurable: true, value: { readContent: vi.fn(async () => '{"nodeData":{"id":"root","topic":"中心主题"}}'), saveContent: save } })
  render(<MindmapCanvas activeFilePath="/vault/test.mind" />)
  await waitFor(() => expect(screen.getByRole("button", { name: "添加子主题" }).hasAttribute("disabled")).toBe(false))
  fireEvent.click(screen.getByRole("button", { name: "添加子主题" }))
  await waitFor(() => expect(state.editors[0].addChild).toHaveBeenCalledTimes(1))
  fireEvent.click(screen.getByRole("button", { name: "添加子主题" }))
  await waitFor(() => expect(state.editors[0].data.nodeData.children[0].children).toHaveLength(1))
  fireEvent.click(screen.getByRole("button", { name: "编辑主题" }))
  await waitFor(() => expect(state.editors[0].beginEdit).toHaveBeenCalled())
  fireEvent.click(screen.getByRole("button", { name: "保存" }))
  await waitFor(() => expect(save).toHaveBeenCalled())
  expect(JSON.parse(save.mock.calls[0][1]).nodeData.children[0].children[0].topic).toBe("分支主题")
})

it("routes branch editing, folding, ordering and layout buttons to the editor", async () => {
  Object.defineProperty(window, "electronAPI", { configurable: true, value: { readContent: vi.fn(async () => '{"nodeData":{"id":"root","topic":"中心主题"}}'), saveContent: vi.fn(async () => {}) } })
  render(<MindmapCanvas activeFilePath="/vault/actions.mind" />)
  await waitFor(() => expect(screen.getByRole("button", { name: "复制分支" }).hasAttribute("disabled")).toBe(false))
  const editor = state.editors[0]
  expect(editor.options).toMatchObject({ overflowHidden: false, mouseSelectionButton: 2, draggable: true, editable: true })
  const node = { nodeObj: { id: "branch", topic: "分支", children: [{ id: "nested", topic: "子主题" }], parent: { id: "root" } } }
  editor.currentNode = node
  for (const label of ["前置同级主题", "插入父主题", "复制分支", "上移主题", "下移主题", "折叠分支", "展开全部", "加粗/取消加粗", "双向布局"]) {
    fireEvent.click(screen.getByRole("button", { name: label }))
  }
  await waitFor(() => expect(editor.copyNode).toHaveBeenCalled())
  expect(editor.insertSibling).toHaveBeenCalledWith("before", node)
  expect(editor.insertParent).toHaveBeenCalledWith(node)
  expect(editor.moveUpNode).toHaveBeenCalledWith(node)
  expect(editor.moveDownNode).toHaveBeenCalledWith(node)
  expect(editor.expandNode).toHaveBeenCalledWith(node, false)
  expect(editor.reshapeNode).toHaveBeenCalledWith(node, { style: { fontWeight: "bold" } })
  expect(editor.initSide).toHaveBeenCalled()
})

it("requests fullscreen on the canvas wrapper containing the floating toolbar", async () => {
  Object.defineProperty(window, "electronAPI", { configurable: true, value: {
    readContent: vi.fn(async () => '{"nodeData":{"id":"root","topic":"主题"}}'), saveContent: vi.fn(async () => {})
  } })
  // The real library creates this native control during init.
  const original = (await import("mind-elixir")).default.prototype.init
  const init = vi.spyOn((await import("mind-elixir")).default.prototype, "init").mockImplementation(function(this: any, data: any) {
    original.call(this, data)
    this.options.el.innerHTML = '<div class="mind-elixir-toolbar"><span id="fullscreen"></span></div>'
  })
  render(<MindmapCanvas activeFilePath="/vault/fullscreen.mind" />)
  await waitFor(() => expect(screen.getByRole("button", { name: "保存" }).hasAttribute("disabled")).toBe(false))
  const toolbar = screen.getByRole("toolbar", { name: "思维导图编辑工具" })
  const wrapper = toolbar.parentElement!
  const requestFullscreen = vi.fn(async () => {})
  Object.defineProperty(wrapper, "requestFullscreen", { configurable: true, value: requestFullscreen })
  fireEvent.click(wrapper.querySelector("#fullscreen")!)
  expect(requestFullscreen).toHaveBeenCalledOnce()
  expect(wrapper.contains(screen.getByRole("button", { name: "拖拽移动工具栏" }))).toBe(true)
  init.mockRestore()
})
