import { beforeEach, expect, it, vi } from "vitest"
const mocks = vi.hoisted(() => ({ sessions: new Map(), guests: [] as any[] }))
vi.mock("electron", () => ({
  session: { fromPartition: vi.fn((partition: string) => {
    if (!mocks.sessions.has(partition)) mocks.sessions.set(partition, {
      clearStorageData: vi.fn(async () => {}), clearCache: vi.fn(async () => {}),
      clearAuthCache: vi.fn(async () => {}), closeAllConnections: vi.fn(async () => {})
    })
    return mocks.sessions.get(partition)
  }) },
  webContents: { getAllWebContents: () => mocks.guests }
}))
vi.mock("@main/browser/browser-session-proxy", () => ({ attachBrowserSessionProxy: vi.fn(async () => {}), detachBrowserSessionProxy: vi.fn() }))
vi.mock("@main/browser/browser-identity", () => ({ applyBrowserIdentity: vi.fn() }))
vi.mock("@main/browser/browser-site-compatibility", () => ({ registerBrowserSiteCompatibility: vi.fn() }))
import { registerBrowserPrivate, isPrivateBrowserSession, isPrivateBrowserPartition } from "@main/browser/browser-private"
import type { WebContents } from "electron"
beforeEach(() => { mocks.sessions.clear(); mocks.guests = [] })
function host() {
  const handlers = new Map<string, (...args: any[]) => any>(), events = new Map<string, (...args: any[]) => any>()
  const contents = { isDestroyed: () => false, mainFrame: {}, ipc: { handle: (name: string, fn: (...args: any[]) => any) => handlers.set(name, fn) },
    on: (name: string, fn: (...args: any[]) => any) => events.set(name, fn), once: (name: string, fn: (...args: any[]) => any) => events.set(name, fn) } as unknown as WebContents
  registerBrowserPrivate(contents)
  return { contents, handlers, events, event: { senderFrame: contents.mainFrame } }
}
it("scopes a nonpersistent partition to its host; closes guests and clears all session data", async () => {
  const a = host(), b = host()
  const partition = await a.handlers.get("browser:private:create")!(a.event)
  expect(partition).not.toMatch(/^persist:/)
  expect(await a.handlers.get("browser:private:create")!(a.event)).toBe(partition)
  expect(isPrivateBrowserPartition(a.contents, partition)).toBe(true)
  expect(isPrivateBrowserPartition(b.contents, partition)).toBe(false)
  const browser = mocks.sessions.get(partition), close = vi.fn(), userClose = vi.fn()
  expect(isPrivateBrowserSession(a.contents, browser)).toBe(true)
  mocks.guests = [{ session: browser, isDestroyed: () => false, close }, { session: {}, isDestroyed: () => false, close: userClose }]
  await a.handlers.get("browser:private:close")!(a.event)
  expect(close).toHaveBeenCalledWith({ waitForBeforeUnload: false })
  expect(userClose).not.toHaveBeenCalled()
  for (const name of ["clearStorageData", "clearCache", "clearAuthCache", "closeAllConnections"]) expect(browser[name]).toHaveBeenCalledTimes(1)
  expect(isPrivateBrowserPartition(a.contents, partition)).toBe(false)
  expect(await a.handlers.get("browser:private:create")!(a.event)).not.toBe(partition)
})
it("rejects subframe requests and cleans up when the host closes", async () => {
  const a = host()
  await expect(a.handlers.get("browser:private:create")!({ senderFrame: {} })).rejects.toThrow("无效")
  const partition = await a.handlers.get("browser:private:create")!(a.event)
  a.events.get("destroyed")!()
  await Promise.resolve()
  expect(isPrivateBrowserPartition(a.contents, partition)).toBe(false)
  await vi.waitFor(() => expect(mocks.sessions.get(partition).clearStorageData).toHaveBeenCalled())
})
it("serializes concurrent creation requests and refuses a session closed during initialization", async () => {
  const a = host()
  const [first, second] = await Promise.all([a.handlers.get("browser:private:create")!(a.event), a.handlers.get("browser:private:create")!(a.event)])
  expect(first).toBe(second)
  await a.handlers.get("browser:private:close")!(a.event)
  const pending = a.handlers.get("browser:private:create")!(a.event)
  const closing = a.handlers.get("browser:private:close")!(a.event)
  await expect(pending).rejects.toThrow("已关闭")
  await closing
})
