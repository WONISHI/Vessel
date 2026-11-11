import { beforeEach, expect, it, vi } from "vitest"
import { runInNewContext } from "node:vm"
import { installExtensionApiShim } from "@main/browser/extensions/extension-api-shim"
import { extensionProxyConfig } from "@main/browser/extensions/extension-proxy-config"
const mocks = vi.hoisted(() => ({ setProxy: vi.fn().mockResolvedValue(undefined), closeAllConnections: vi.fn().mockResolvedValue(undefined), on: vi.fn() }))
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
