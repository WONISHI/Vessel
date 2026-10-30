import { runInNewContext } from "node:vm"
import { expect, it } from "vitest"
import { mkdtemp, mkdir, readFile, writeFile, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { prepareExtensionRuntime } from "@main/browser/extensions/extension-runtime"
import { installExtensionApiShim } from "@main/browser/extensions/extension-api-shim"
it("bootstraps a managed MV3 worker before extension imports without changing its extension path", async () => {
  const root = await mkdtemp(join(tmpdir(), "vessel-extension-"))
  const source = join(root, "browser-extension-packages", "import-demo")
  try {
    await mkdir(source, { recursive: true })
    await writeFile(join(source, "manifest.json"), JSON.stringify({ manifest_version: 3, background: { service_worker: "sw.js" } }))
    await writeFile(join(source, "sw.js"), 'importScripts("./service.js");')
    expect(await prepareExtensionRuntime(source, join(root, "browser-extension-runtime"))).toBe(source)
    await prepareExtensionRuntime(source, join(root, "browser-extension-runtime"))
    const worker = await readFile(join(source, "sw.js"), "utf8")
    expect(worker.indexOf("management.getAll")).toBeLessThan(worker.indexOf('importScripts("./service.js")'))
    expect(worker.split("/* vessel-extension-bootstrap */")).toHaveLength(2)
    const chrome: any = { runtime: { id: "test-extension", getManifest: () => ({ name: "test", version: "1" }) } }
    let imported = false
    runInNewContext(worker, { chrome, setTimeout, importScripts: () => {
      imported = true
      expect(typeof chrome.management.getAll).toBe("function")
    } })
    expect(imported).toBe(true)
    expect(await chrome.management.getAll()).toMatchObject([{ id: "test-extension", enabled: true }])
  } finally { await rm(root, { recursive: true, force: true }) }
})

it("patches login pages before their scripts and upgrades an already bootstrapped worker", async () => {
  const root = await mkdtemp(join(tmpdir(), "vessel-extension-upgrade-"))
  const source = join(root, "browser-extension-packages", "igg")
  try {
    await mkdir(source, { recursive: true })
    await writeFile(join(source, "manifest.json"), JSON.stringify({ background: { service_worker: "sw.js" } }))
    await writeFile(join(source, "sw.js"), '/* vessel-extension-bootstrap */\n;(function(){globalThis.oldShim=true;})();\nimportScripts("service.js");')
    await writeFile(join(source, "login.html"), '<html><head></head><body><script src="login.js"></script></body></html>')
    await prepareExtensionRuntime(source, join(root, "browser-extension-runtime"))
    await prepareExtensionRuntime(source, join(root, "browser-extension-runtime"))
    const worker = await readFile(join(source, "sw.js"), "utf8")
    expect(worker).not.toContain("oldShim")
    expect(worker.match(/importScripts\("service.js"\)/g)).toHaveLength(1)
    const html = await readFile(join(source, "login.html"), "utf8")
    expect(html.indexOf("vessel-extension-compat.js")).toBeLessThan(html.indexOf('src="login.js"'))
    expect(html.match(/vessel-extension-compat.js/g)).toHaveLength(1)
  } finally { await rm(root, { recursive: true, force: true }) }
})

it("opens login tabs without rewriting the actual extension identity in authentication requests", async () => {
  const opened: string[] = []
  let body: unknown
  class XHR { send(value: unknown) { body = value } }
  const chrome: any = { runtime: { id: "local-id", getManifest: () => ({ author: "mzkeapp@gmail.com" }) } }
  runInNewContext(`(${installExtensionApiShim.toString()})()`, { chrome, XMLHttpRequest: XHR, setTimeout, URL, open: (url: string) => opened.push(url) })
  await chrome.tabs.create({ url: "chrome-extension://local-id/login.html?/muser/login" })
  expect(opened).toEqual(["chrome-extension://local-id/login.html?/muser/login"])
  new XHR().send("runtime_id=local-id")
  expect(body).toBe("runtime_id=local-id")
  expect(await chrome.management.getAll()).toMatchObject([{ id: "local-id" }])
})

it("routes worker tab creation to the authenticated host bridge without calling clients.openWindow", async () => {
  const requests: any[] = []
  const chrome: any = { runtime: { id: "local-id", getManifest: () => ({}) } }
  let attemptedWindow = false
  runInNewContext(`(${installExtensionApiShim.toString()})("test-capability")`, {
    chrome, setTimeout, URL,
    clients: { openWindow: () => { attemptedWindow = true; throw new Error("InvalidAccessError") } },
    fetch: async (url: string, options: any) => { requests.push({ url, options }); return { ok: true } }
  })
  await chrome.tabs.create({ url: "chrome-extension://local-id/login.html" })
  expect(attemptedWindow).toBe(false)
  expect(requests).toHaveLength(1)
  expect(requests[0].options.headers.Authorization).toBe("Bearer test-capability")
  expect(JSON.parse(requests[0].options.body)).toEqual({ url: "chrome-extension://local-id/login.html" })
})
it("diagnoses login rejection without forwarding account, verification code or token values", async () => {
  const requests: any[] = []
  const chrome: any = { runtime: { id: "local-id", getManifest: () => ({ author: "mzkeapp@gmail.com" }) } }
  const context: any = { chrome, setTimeout, URL, fetch: async (url: string, options: any) => {
    requests.push({ url, options })
    return { status: 200, clone: () => ({ json: async () => ({ result: "error", msg: "Token is invalid" }) }) }
  } }
  runInNewContext(`(${installExtensionApiShim.toString()})("test-capability")`, context)
  const body = JSON.stringify({ runtime_id: "local-id", token: "secret-token", form_token: "secret-form-token", email: "private@example.com", code: "secret-code" })
  await context.fetch("https://example.com/chromeext/v2/email_login", { body })
  await new Promise((resolve) => setTimeout(resolve, 0))
  const report = requests.find((request) => request.url.includes("extension-login-diagnostic"))
  expect(requests[0].options.body).toBe(body)
  expect(JSON.parse(report.options.body)).toMatchObject({ invalidToken: true, runtimeIdMatched: true, tokenPresent: true, formTokenPresent: true })
  for (const secret of ["secret-token", "secret-form-token", "private@example.com", "secret-code"]) expect(report.options.body).not.toContain(secret)
})

it("migrates reserved filenames and MV2 manifest references without duplicating scripts", async () => {
  const root = await mkdtemp(join(tmpdir(), "vessel-extension-migrate-"))
  const source = join(root, "browser-extension-packages", "import-demo")
  try {
    await mkdir(source, { recursive: true })
    await writeFile(join(source, "manifest.json"), JSON.stringify({ manifest_version: 2, background: { scripts: ["__vessel_extension_compat.js", "background.js"] } }))
    await writeFile(join(source, "__vessel_extension_compat.js"), "old")
    const cache = join(root, "browser-extension-runtime")
    await prepareExtensionRuntime(source, cache)
    await prepareExtensionRuntime(source, cache)
    const manifest = JSON.parse(await readFile(join(source, "manifest.json"), "utf8"))
    expect(manifest.background.scripts).toEqual(["vessel-extension-compat.js", "background.js"])
    await expect(readFile(join(source, "__vessel_extension_compat.js"))).rejects.toMatchObject({ code: "ENOENT" })
    expect(await readFile(join(source, "vessel-extension-compat.js"), "utf8")).toContain("management.getAll")
    manifest.background = { page: "background.html" }
    await writeFile(join(source, "manifest.json"), JSON.stringify(manifest))
    await writeFile(join(source, "background.html"), '<html><head><script src="/__vessel_extension_compat.js"></script></head><body></body></html>')
    await prepareExtensionRuntime(source, cache)
    await prepareExtensionRuntime(source, cache)
    const html = await readFile(join(source, "background.html"), "utf8")
    expect(html).not.toContain("__vessel_extension_compat")
    expect(html.match(/vessel-extension-compat\.js/g)).toHaveLength(1)
  } finally { await rm(root, { recursive: true, force: true }) }
})
