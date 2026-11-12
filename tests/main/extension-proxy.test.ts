import { beforeEach, expect, it, vi } from "vitest"
import { runInNewContext } from "node:vm"
import { installExtensionApiShim } from "@main/browser/extensions/extension-api-shim"
import { extensionProxyConfig } from "@main/browser/extensions/extension-proxy-config"
const listeners = vi.hoisted(() => new Map<string, any>())
const mocks = vi.hoisted(() => ({ setProxy: vi.fn().mockResolvedValue(undefined), closeAllConnections: vi.fn().mockResolvedValue(undefined), on: vi.fn((name: string, listener: any) => listeners.set(name, listener)) }))
vi.mock("electron", () => ({ app: { on: mocks.on }, session: { fromPartition: () => mocks } }))
import { extensionProxyRequest, registerExtensionProxy, releaseExtensionProxy } from "@main/browser/extensions/extension-proxy"
beforeEach(() => vi.clearAllMocks())
it("translates PAC content and per-protocol proxy rules without discarding bypasses", () => {
  const data = 'function FindProxyForURL(){ return "PROXY localhost:8888"; }'
  expect(extensionProxyConfig({ mode: "pac_script", pacScript: { data } }).pacScript).toBe(`data:application/x-ns-proxy-autoconfig;base64,${Buffer.from(data).toString("base64")}`)
  expect(extensionProxyConfig({ mode: "fixed_servers", rules: { proxyForHttps: { host: "proxy.test", port: 443, scheme: "https" }, bypassList: ["<local>", "*.example.test"] } })).toEqual({ mode: "fixed_servers", proxyRules: "https=https://proxy.test:443", proxyBypassRules: "<local>;*.example.test" })
  expect(() => extensionProxyConfig({ mode: "fixed_servers", rules: { singleProxy: { host: "host;DIRECT" } } })).toThrow()
})
it("applies real session settings, enforces permission and restores system on unload", async () => {
  registerExtensionProxy("allowed", "test", () => true)
  await extensionProxyRequest("allowed", { action: "set", value: { mode: "direct" } })
  expect(mocks.setProxy).toHaveBeenCalledWith({ mode: "direct" })
  expect(mocks.closeAllConnections).toHaveBeenCalledOnce()
  expect(await extensionProxyRequest("allowed", { action: "get" })).toMatchObject({ levelOfControl: "controlled_by_this_extension" })
  await expect(extensionProxyRequest("unknown", { action: "set", value: { mode: "direct" } })).rejects.toThrow()
  await releaseExtensionProxy("test")
  expect(mocks.setProxy).toHaveBeenLastCalledWith({ mode: "system" })
})
it("upgrades a tokenless page shim and waits for actual setProxy success", async () => {
  const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({}) })
  const chrome: any = { runtime: { id: "test", getManifest: () => ({}) } }
  const context = { chrome, fetch, setTimeout }
  runInNewContext(`(${installExtensionApiShim.toString()})()`, context)
  runInNewContext(`(${installExtensionApiShim.toString()})("capability")`, context)
  await chrome.proxy.settings.set({ value: { mode: "system" } })
  expect(fetch).toHaveBeenCalledWith("http://127.0.0.1:35678/api/extension-proxy", expect.objectContaining({ headers: expect.objectContaining({ Authorization: "Bearer capability" }), body: JSON.stringify({ action: "set", value: { mode: "system" } }) }))
  fetch.mockResolvedValueOnce({ ok: false, json: async () => ({ error: "setProxy failed" }) })
  await expect(chrome.proxy.settings.set({ value: { mode: "direct" } })).rejects.toThrow("setProxy failed")
})
it("restores the session even after the extension's permission is revoked", async () => {
  let enabled = true
  registerExtensionProxy("revoked", "revoked-key", () => enabled)
  await extensionProxyRequest("revoked", { action: "set", value: { mode: "direct" } })
  enabled = false
  await releaseExtensionProxy("revoked-key")
  expect(mocks.setProxy).toHaveBeenLastCalledWith({ mode: "system" })
  await expect(extensionProxyRequest("revoked", { action: "get" })).rejects.toThrow()
})
it("rejects queued writes after unloading starts", async () => {
  registerExtensionProxy("queued", "queued-key", () => true)
  const write = extensionProxyRequest("queued", { action: "set", value: { mode: "direct" } })
  const rejection = expect(write).rejects.toThrow("扩展已禁用")
  await releaseExtensionProxy("queued-key")
  await rejection
  expect(mocks.setProxy).not.toHaveBeenCalled()
})
it("delivers credentials only for authentication requests owned by the extension", async () => {
  registerExtensionProxy("auth-owner", "auth-key", () => true)
  registerExtensionProxy("auth-other", "other-key", () => true)
  await extensionProxyRequest("auth-owner", { action: "set", value: { mode: "direct" } })
  const login = listeners.get("login")
  expect(login).toBeTypeOf("function")
  const event = { preventDefault: vi.fn() }, callback = vi.fn()
  ;login(event, { session: mocks }, { url: "https://example.test" }, { isProxy: true, scheme: "basic", host: "proxy.test", port: 8080, realm: "proxy" }, callback)
  expect(event.preventDefault).toHaveBeenCalledOnce()
  expect(await extensionProxyRequest("auth-other", { action: "auth-poll" })).toEqual([])
  const [request] = await extensionProxyRequest("auth-owner", { action: "auth-poll" }) as any[]
  await extensionProxyRequest("auth-other", { action: "auth-reply", requestId: request.requestId, authCredentials: { username: "wrong", password: "wrong" } })
  expect(callback).not.toHaveBeenCalled()
  await extensionProxyRequest("auth-owner", { action: "auth-reply", requestId: request.requestId, authCredentials: { username: "user", password: "secret" } })
  expect(callback).toHaveBeenCalledWith("user", "secret")
  await releaseExtensionProxy("auth-key")
  await releaseExtensionProxy("other-key")
})
it("keeps auth listeners registered before the capability upgrade", async () => {
  const scheduled: (() => Promise<void>)[] = []
  const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => [] })
  const chrome: any = { runtime: { id: "test", getManifest: () => ({}) } }
  const context = { chrome, fetch, setTimeout: (callback: () => Promise<void>) => scheduled.push(callback) }
  runInNewContext(`(${installExtensionApiShim.toString()})()`, context)
  const listener = vi.fn(() => ({ authCredentials: { username: "user", password: "secret" } }))
  chrome.webRequest.onAuthRequired.addListener(listener)
  await Promise.resolve()
  await Promise.resolve()
  runInNewContext(`(${installExtensionApiShim.toString()})("upgraded")`, context)
  expect(chrome.webRequest.onAuthRequired.hasListener(listener)).toBe(true)
  fetch.mockResolvedValueOnce({ ok: true, json: async () => [{ requestId: "auth-request", isProxy: true }] })
  await scheduled.shift()!()
  expect(listener).toHaveBeenCalledOnce()
  expect(fetch).toHaveBeenLastCalledWith(expect.any(String), expect.objectContaining({ headers: expect.objectContaining({ Authorization: "Bearer upgraded" }), body: JSON.stringify({ action: "auth-reply", requestId: "auth-request", authCredentials: { username: "user", password: "secret" } }) }))
  chrome.webRequest.onAuthRequired.removeListener(listener)
})
it("preserves the active proxy on set failure and allows a later retry", async () => {
  registerExtensionProxy("retry", "retry-key", () => true)
  await extensionProxyRequest("retry", { action: "set", value: { mode: "direct" } })
  mocks.setProxy.mockRejectedValueOnce(new Error("proxy rejected"))
  await expect(extensionProxyRequest("retry", { action: "set", value: { mode: "system" } })).rejects.toThrow("proxy rejected")
  expect(await extensionProxyRequest("retry", { action: "get" })).toMatchObject({ value: { mode: "direct" } })
  await extensionProxyRequest("retry", { action: "set", value: { mode: "auto_detect" } })
  expect(mocks.setProxy).toHaveBeenLastCalledWith({ mode: "auto_detect" })
  await releaseExtensionProxy("retry-key")
})
