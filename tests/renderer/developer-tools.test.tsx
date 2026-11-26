import { render, screen, fireEvent, cleanup, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { JsonTool, Base64Tool, URLTool } from "@/pages/debug/components/utility-tools"
vi.mock("@/components/core/canvas/variants/code/monaco", () => ({ monaco: {} }))
vi.mock("@monaco-editor/react", () => ({
  default: ({ value, onChange }: { value: string; onChange: (value: string) => void }) => (
    <textarea
      aria-label="JSON 编辑器"
      value={value}
      onChange={(event) => onChange(event.target.value)}
    />
  )
}))
beforeEach(() => {
  window.electronAPI = { getJsonShare: vi.fn().mockResolvedValue(null), startJsonShare: vi.fn(), stopJsonShare: vi.fn() } as any
})
afterEach(cleanup)
it("formats JSON and reports malformed input", () => {
  render(<JsonTool />)
  fireEvent.change(screen.getByLabelText("JSON 编辑器"), { target: { value: '{"a":1}' } })
  fireEvent.click(screen.getByRole("button", { name: "格式化" }))
  expect(screen.getByLabelText("JSON 编辑器")).toHaveProperty("value", '{\n  "a": 1\n}')
  fireEvent.click(screen.getByRole("button", { name: "压缩" }))
  expect(screen.getByLabelText("JSON 编辑器")).toHaveProperty("value", '{"a":1}')
  expect(screen.queryByLabelText("处理结果")).toBeNull()
  fireEvent.change(screen.getByLabelText("JSON 编辑器"), { target: { value: "{" } })
  fireEvent.click(screen.getByRole("button", { name: "格式化" }))
  expect(screen.getByRole("alert")).toBeTruthy()
})
it("round trips Unicode Base64 and URL encoding", () => {
  for (const [Tool, label] of [
    [Base64Tool, "Base64"],
    [URLTool, "URL 编解码"]
  ] as const) {
    const view = render(<Tool />)
    fireEvent.change(screen.getByLabelText(label + "输入"), { target: { value: "中文 🟢 &/?" } })
    fireEvent.click(screen.getByRole("button", { name: "编码" }))
    const encoded = (screen.getByLabelText("处理结果") as HTMLTextAreaElement).value
    fireEvent.change(screen.getByLabelText(label + "输入"), { target: { value: encoded } })
    fireEvent.click(screen.getByRole("button", { name: "解码" }))
    expect(screen.getByLabelText("处理结果")).toHaveProperty("value", "中文 🟢 &/?")
    view.unmount()
  }
})

it("preserves a JSON draft across route unmounts and keeps explicit clearing", () => {
  const first = render(<JsonTool />)
  fireEvent.change(screen.getByLabelText("JSON 编辑器"), { target: { value: '{"draft":"路由切换保留"}' } })
  first.unmount()
  const returned = render(<JsonTool />)
  expect(screen.getByLabelText("JSON 编辑器")).toHaveProperty("value", '{"draft":"路由切换保留"}')
  fireEvent.click(screen.getByRole("button", { name: "格式化" }))
  returned.unmount()
  const formatted = render(<JsonTool />)
  expect(screen.getByLabelText("JSON 编辑器")).toHaveProperty("value", '{\n  "draft": "路由切换保留"\n}')
  fireEvent.click(screen.getByRole("button", { name: "清空内容" }))
  formatted.unmount()
  render(<JsonTool />)
  expect(screen.getByLabelText("JSON 编辑器")).toHaveProperty("value", "")
})

it("formats and compresses a copied escaped JSON string as an object", () => {
  render(<JsonTool />)
  const input = String.raw`"{\\"key\\":\\"2108449341377019905\\",\\"title\\":\\"考后复核材料申报\\",\\"data\\":{\\"url\\":\\"https\://example.test/file.pdf\\"},\\"metadata\\":{\\"usePassApi\\":true}}"`
  fireEvent.change(screen.getByLabelText("JSON 编辑器"), { target: { value: input } })
  fireEvent.click(screen.getByRole("button", { name: "格式化" }))
  expect(screen.queryByRole("alert")).toBeNull()
  const formatted = (screen.getByLabelText("JSON 编辑器") as HTMLTextAreaElement).value
  expect(formatted).toContain('\n  "key": "2108449341377019905"')
  expect(JSON.parse(formatted).data.url).toBe("https://example.test/file.pdf")
  fireEvent.click(screen.getByRole("button", { name: "压缩" }))
  expect((screen.getByLabelText("JSON 编辑器") as HTMLTextAreaElement).value).toBe(JSON.stringify(JSON.parse(formatted)))
})

it("expands all embedded JSON with the adjacent JSON-ize button and retains malformed input on error", () => {
  render(<JsonTool />)
  const input = screen.getByLabelText("JSON 编辑器") as HTMLTextAreaElement
  const value = JSON.stringify({ formId: "2124707628909002754", item: JSON.stringify({ nested: '[{"ok":true}]' }), list: ['{"more":[]}'], label: "1" })
  fireEvent.change(input, { target: { value } })
  fireEvent.click(screen.getByRole("button", { name: "格式化" }))
  expect(typeof JSON.parse(input.value).item).toBe("string")
  fireEvent.click(screen.getByRole("button", { name: "JSON 化" }))
  expect(input.value).toBe(JSON.stringify({ formId: "2124707628909002754", item: { nested: [{ ok: true }] }, list: [{ more: [] }], label: "1" }, null, 2))
  const buttons = screen.getAllByRole("button")
  expect(buttons.indexOf(screen.getByRole("button", { name: "JSON 化" }))).toBe(buttons.indexOf(screen.getByRole("button", { name: "格式化" })) + 1)
  fireEvent.change(input, { target: { value: '{"broken":}' } })
  fireEvent.click(screen.getByRole("button", { name: "JSON 化" }))
  expect(screen.getByRole("alert")).toBeTruthy()
  expect(input.value).toBe('{"broken":}')
})


it("starts LAN sharing, copies the link, restores it across routes and cancels sharing", async () => {
  const info = { urls: ["http://192.168.1.20:40000/secret"], startedAt: 1 }
  const start = vi.fn().mockResolvedValue(info)
  const stop = vi.fn().mockResolvedValue(undefined)
  window.electronAPI.startJsonShare = start
  window.electronAPI.stopJsonShare = stop
  const writeText = vi.fn().mockResolvedValue(undefined)
  Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } })
  const view = render(<JsonTool />)
  fireEvent.change(screen.getByLabelText("JSON 编辑器"), { target: { value: '{"formId":"2124707628909002754","item":"{\\"ok\\":true}"}' } })
  await waitFor(() => expect((screen.getByRole("button", { name: "分享" }) as HTMLButtonElement).disabled).toBe(false))
  fireEvent.click(screen.getByRole("button", { name: "分享" }))
  expect(await screen.findByRole("button", { name: "取消分享" })).toBeTruthy()
  expect(JSON.parse(start.mock.calls[0][0]).formId).toBe("2124707628909002754")
  expect(typeof JSON.parse(start.mock.calls[0][0]).item).toBe("string")
  expect(screen.getByRole("textbox", { name: "局域网分享链接" })).toHaveProperty("value", info.urls[0])
  fireEvent.click(screen.getByRole("button", { name: "复制链接" }))
  expect(writeText).toHaveBeenCalledWith(info.urls[0])
  view.unmount()
  expect(stop).not.toHaveBeenCalled()
  window.electronAPI.getJsonShare = vi.fn().mockResolvedValue(info)
  render(<JsonTool />)
  fireEvent.click(await screen.findByRole("button", { name: "取消分享" }))
  await waitFor(() => expect(stop).toHaveBeenCalledOnce())
  expect(await screen.findByRole("button", { name: "分享" })).toBeTruthy()
  expect(screen.queryByRole("region", { name: "局域网分享" })).toBeNull()
})

it("adds independent JSON tabs, preserves drafts and errors across switching, and confirms closing content", async () => {
  render(<JsonTool />)
  const firstTab = screen.getByRole('tab', { selected: true })
  const firstName = firstTab.textContent!
  fireEvent.change(screen.getByLabelText('JSON 编辑器'), { target: { value: '{"first":1}' } })
  fireEvent.click(screen.getByRole('button', { name: '新增 JSON' }))
  const secondTab = screen.getByRole('tab', { selected: true })
  const secondName = secondTab.textContent!
  expect(secondName).not.toBe(firstName)
  expect(screen.getByLabelText('JSON 编辑器')).toHaveProperty('value', '')
  fireEvent.change(screen.getByLabelText('JSON 编辑器'), { target: { value: '{"broken":}' } })
  fireEvent.click(screen.getByRole('button', { name: '格式化' }))
  expect(screen.getByRole('alert')).toBeTruthy()
  fireEvent.click(screen.getByRole('tab', { name: firstName }))
  expect(screen.getByLabelText('JSON 编辑器')).toHaveProperty('value', '{"first":1}')
  expect(screen.queryByRole('alert')).toBeNull()
  fireEvent.click(screen.getByRole('tab', { name: secondName }))
  expect(screen.getByRole('alert')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: `关闭 ${secondName}` }))
  expect(await screen.findByRole('dialog')).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: '保留文档' }))
  expect(screen.getByRole('tab', { name: secondName })).toBeTruthy()
  fireEvent.click(screen.getByRole('button', { name: `关闭 ${secondName}` }))
  fireEvent.click(screen.getByRole('button', { name: '关闭文档' }))
  await waitFor(() => expect(screen.queryByRole('tab', { name: secondName })).toBeNull())
  expect(screen.getByLabelText('JSON 编辑器')).toHaveProperty('value', '{"first":1}')
})

it("keeps sharing scoped to its document while adding and switching JSON tabs", async () => {
  const shares = new Map<string, { urls: string[]; startedAt: number }>()
  window.electronAPI.getJsonShare = vi.fn(async (id = 'default') => shares.get(id) || null)
  window.electronAPI.startJsonShare = vi.fn(async (_text, id = 'default') => {
    const info = { urls: [`http://192.168.1.20/${id}`], startedAt: 1 }
    shares.set(id, info)
    return info
  })
  render(<JsonTool />)
  const first = screen.getByRole('tab', { selected: true }).textContent!
  fireEvent.change(screen.getByLabelText('JSON 编辑器'), { target: { value: '{"shared":1}' } })
  await waitFor(() => expect((screen.getByRole('button', { name: '分享' }) as HTMLButtonElement).disabled).toBe(false))
  fireEvent.click(screen.getByRole('button', { name: '分享' }))
  const original = await screen.findByRole('textbox', { name: '局域网分享链接' }) as HTMLInputElement
  const link = original.value
  fireEvent.click(screen.getByRole('button', { name: '新增 JSON' }))
  expect(screen.queryByRole('region', { name: '局域网分享' })).toBeNull()
  fireEvent.click(screen.getByRole('tab', { name: new RegExp(first) }))
  await waitFor(() => expect(screen.getByRole('textbox', { name: '局域网分享链接' })).toHaveProperty('value', link))
  expect(screen.getByRole('button', { name: '取消分享' })).toBeTruthy()
  expect(window.electronAPI.stopJsonShare).not.toHaveBeenCalled()
})

it("keeps keyboard focus on tabs during arrow navigation and closes an empty document without confirmation", async () => {
  render(<JsonTool />)
  const firstName = screen.getAllByRole('tab').at(-1)!.textContent!
  fireEvent.click(screen.getByRole('button', { name: '新增 JSON' }))
  const secondName = screen.getByRole('tab', { selected: true }).textContent!
  fireEvent.keyDown(screen.getByRole('tab', { selected: true }), { key: 'ArrowLeft' })
  expect(screen.getByRole('tab', { name: firstName, selected: true })).toBe(document.activeElement)
  fireEvent.click(screen.getByRole('tab', { name: secondName }))
  fireEvent.click(screen.getByRole('button', { name: `关闭 ${secondName}` }))
  await waitFor(() => expect(screen.queryByRole('tab', { name: secondName })).toBeNull())
  expect(screen.queryByRole('dialog')).toBeNull()
})
