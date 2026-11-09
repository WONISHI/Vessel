import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import { afterEach, beforeEach, expect, it, vi } from "vitest"
import { MemoryRouter } from "react-router-dom"
import type { ReactNode } from "react"

vi.mock("@/components/layout/index", () => ({ default: ({ children }: { children: ReactNode }) => <div>{children}</div> }))
vi.mock("@/components/layout/activity-bar/index", () => ({ default: () => null }))
vi.mock("@/components/ui/status-bar", () => ({ StatusBar: ({ left, children }: { left?: ReactNode; children?: ReactNode }) => <footer>{left}{children}</footer> }))
vi.mock("@/components/ui/resizable-panels", () => ({
  ResizablePanelGroup: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  ResizablePanel: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  ResizableHandle: () => null
}))
vi.mock("@/pages/postman/components/code-editor", () => ({ ApiCodeEditor: ({ value, ariaLabel, onChange }: { value: string; ariaLabel: string; onChange?: (value: string) => void }) => <textarea aria-label={ariaLabel} value={value} onChange={(event) => onChange?.(event.target.value)} /> }))

const send = vi.fn()
const saveRequest = vi.fn()
const saveEnvironment = vi.fn()
const env = { id: "env-dev", name: "Dev 环境", variables: JSON.stringify([{ key: "baseUrl", value: "https://x.test", enabled: true }]), isActive: true }

beforeEach(() => {
  localStorage.clear()
  Element.prototype.scrollIntoView = vi.fn()
  vi.stubGlobal("ResizeObserver", class { observe() {} unobserve() {} disconnect() {} })
  send.mockResolvedValue({ status: 200, statusText: "OK", headers: { "content-type": "application/json" }, cookies: [], durationMs: 12, sizeBytes: 9, body: '{"id":1}', bodyEncoding: "text", contentType: "application/json", testResults: [], envUpdates: { token: "abc" }, logs: [] })
  saveRequest.mockImplementation(async (record) => record)
  saveEnvironment.mockImplementation(async (next) => [next])
  Object.defineProperty(window, "electronAPI", {
    configurable: true,
    value: {
      apiClient: {
        listCollections: vi.fn(async () => [{ id: "c1", name: "我的集合", parentId: null, createdAt: 0, sortOrder: 0 }]),
        listRequests: vi.fn(async () => []),
        listHistory: vi.fn(async () => []),
        listEnvironments: vi.fn(async () => [env]),
        send,
        saveRequest,
        saveEnvironment,
        saveCollection: vi.fn(async () => []),
        setActiveEnvironment: vi.fn(async () => [env])
      }
    }
  })
})
afterEach(cleanup)

it("syncs params with the URL, highlights variables, sends with env vars and saves new requests into a collection", async () => {
  const { default: PostmanPage } = await import("@/pages/postman/index")
  render(<MemoryRouter><PostmanPage /></MemoryRouter>)
  await screen.findAllByText("Dev 环境")

  const url = screen.getByLabelText("请求 URL") as HTMLInputElement
  fireEvent.change(url, { target: { value: "{{baseUrl}}/users?page=1&q={{missing}}" } })
  expect(screen.getAllByLabelText("参数名").map((input) => (input as HTMLInputElement).value)).toEqual(["page", "q", ""])
  expect(url.getAttribute("data-title")).toContain("{{baseUrl}} = https://x.test")
  expect(url.getAttribute("data-title")).toContain("{{missing}} = （未定义）")

  const values = screen.getAllByLabelText("参数值") as HTMLInputElement[]
  fireEvent.change(values[0], { target: { value: "2" } })
  fireEvent.change(screen.getAllByLabelText("参数名").at(-1)!, { target: { value: "size" } })
  expect(url.value).toBe("{{baseUrl}}/users?page=2&q={{missing}}&size")
  fireEvent.click(screen.getAllByLabelText("启用")[1])
  expect(url.value).toBe("{{baseUrl}}/users?page=2&size")

  await act(async () => { fireEvent.click(screen.getByRole("button", { name: /发送/ })) })
  expect(send).toHaveBeenCalledWith(expect.objectContaining({ url: "{{baseUrl}}/users?page=2&size", params: [], envVariables: { baseUrl: "https://x.test" } }))
  await waitFor(() => expect(saveEnvironment).toHaveBeenCalledWith(expect.objectContaining({ id: "env-dev", variables: JSON.stringify([{ key: "baseUrl", value: "https://x.test", enabled: true }, { key: "token", value: "abc", enabled: true }]) })))
  expect(await screen.findByLabelText("响应内容")).toHaveProperty("value", '{\n  "id": 1\n}')

  const tabs = within(screen.getByRole("tablist", { name: "请求标签页" }))
  expect(tabs.getByLabelText("关闭（有未保存的修改）")).toBeTruthy()
  fireEvent.keyDown(url, { key: "s", metaKey: true })
  const dialog = await screen.findByRole("dialog")
  fireEvent.change(within(dialog).getAllByRole("textbox")[0], { target: { value: "用户列表" } })
  await act(async () => { fireEvent.click(within(dialog).getByRole("button", { name: "保存" })) })
  expect(saveRequest).toHaveBeenCalledWith(expect.objectContaining({ name: "用户列表", collectionId: "c1", url: "{{baseUrl}}/users?page=2&size" }))
  await waitFor(() => expect(tabs.queryByLabelText("关闭（有未保存的修改）")).toBeNull())

  fireEvent.click(screen.getByLabelText("新建请求标签"))
  expect(tabs.getAllByRole("tab")).toHaveLength(2)
  fireEvent.change(screen.getByLabelText("请求 URL"), { target: { value: "curl 'https://x.test/a?b=1' -H 'X-A: 1' --data-raw '{\"k\":1}'" } })
  expect((screen.getByLabelText("请求 URL") as HTMLInputElement).value).toBe("https://x.test/a?b=1")
  expect(tabs.getAllByRole("tab")[1].textContent).toContain("POST")
})
