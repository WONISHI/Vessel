import { EventEmitter } from "node:events"
import { tmpdir } from "node:os"
import { afterEach, beforeEach, expect, it, vi } from "vitest"

const mocks = vi.hoisted(() => ({ spawn: vi.fn(), terminate: vi.fn() }))
vi.mock("node-pty", () => ({ spawn: mocks.spawn }))
vi.mock("@main/terminal/process-tree", () => ({ terminateTerminalTree: mocks.terminate }))
import { closeAllTerminals, registerTerminal, resumeTerminalStarts } from "@main/terminal/terminal"

const hosts: ReturnType<typeof makeHost>[] = []
function makeHost() {
  const handlers = new Map<string, (...args: any[]) => any>()
  const host = Object.assign(new EventEmitter(), { ipc: { handle: (name: string, handler: (...args: any[]) => any) => handlers.set(name, handler) }, isDestroyed: () => false, send: vi.fn() })
  registerTerminal(host as any)
  const value = { host, start: () => handlers.get("terminal:start")!({}, tmpdir()), close: (id: string) => handlers.get("terminal:close")!({}, id) }
  hosts.push(value)
  return value
}
beforeEach(() => {
  resumeTerminalStarts()
  let pid = 10000
  mocks.spawn.mockImplementation(() => ({ pid: pid++, onData: vi.fn(), onExit: vi.fn(), write: vi.fn(), resize: vi.fn(), kill: vi.fn() }))
})
afterEach(() => { for (const { host } of hosts.splice(0)) host.emit("destroyed"); resumeTerminalStarts() })

it("closes every terminal in every registered window and blocks new sessions while quitting", async () => {
  const first = makeHost(), second = makeHost()
  await first.start()
  await first.start()
  await second.start()
  closeAllTerminals()
  expect(mocks.terminate).toHaveBeenCalledTimes(3)
  expect(new Set(mocks.terminate.mock.calls.map(([pty]) => pty.pid)).size).toBe(3)
  await expect(first.start()).rejects.toThrow("正在关闭")
  closeAllTerminals()
  expect(mocks.terminate).toHaveBeenCalledTimes(3)
})

it("closes only the requested session, then cleans remaining sessions when its owner closes", async () => {
  const first = makeHost(), second = makeHost()
  const selected = await first.start()
  await first.start()
  await second.start()
  first.close(selected.id)
  expect(mocks.terminate).toHaveBeenCalledTimes(1)
  first.host.emit("destroyed")
  expect(mocks.terminate).toHaveBeenCalledTimes(2)
  second.host.emit("did-start-navigation", {}, "file:///app", true, true)
  expect(mocks.terminate).toHaveBeenCalledTimes(2)
  second.host.emit("did-start-navigation", {}, "file:///app", false, true)
  expect(mocks.terminate).toHaveBeenCalledTimes(3)
})

it("does not spawn a terminal when a pending directory lookup outlives window closure or reload", async () => {
  const first = makeHost()
  const pending = first.start()
  first.host.emit("destroyed")
  await expect(pending).rejects.toThrow("关闭")
  expect(mocks.spawn).not.toHaveBeenCalled()
  const second = makeHost()
  const reload = second.start()
  second.host.emit("did-start-navigation", {}, "file:///app", false, true)
  await expect(reload).rejects.toThrow("重新加载")
  expect(mocks.spawn).not.toHaveBeenCalled()
})
