import { ProxyTrafficCounter, subscriptionInfo } from "./proxy-metrics"
import { ProxySubscriptions } from "./proxy-subscriptions"
import { setBrowserSessionProxy, closeBrowserSessionConnections } from "./browser-session-proxy"
import { browserProxyConfig } from "@main/browser/browser-proxy-config"
import release from "@main/mihomo-release.json"
import { generalSettings, settingsEvents } from "@main/settings/settings"
import type { BrowserProxyStatus, BrowserProxyMode, BrowserProxySubscriptionInfo } from "@vessel/type"
import { app, net, safeStorage, type WebContents } from "electron"
import { spawn, execFile, type ChildProcess } from "node:child_process"
import { createHash, randomUUID } from "node:crypto"
import { chmod, mkdir, readFile, rename, writeFile } from "node:fs/promises"
import { createServer } from "node:net"
import { join } from "node:path"
import { gunzipSync } from "node:zlib"
const state: BrowserProxyStatus = { connected: false, busy: false, stage: "未连接", nodes: [], selected: "", hasSubscription: false }
let child: ChildProcess | undefined,
  controller = 0,
  secret = "",
  memoryURL = ""

/** Performs the directory operation. */
const directory = () => join(app.getPath("userData"), "browser-proxy")

/** Performs the pause operation. */
const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/** Performs the free port operation. */
async function freePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer()
    server.on("error", reject)
    server.listen(0, "127.0.0.1", () => {
      const address = server.address()
      const port = typeof address === "object" && address ? address.port : 0
      server.close((error) => (error ? reject(error) : resolve(port)))
    })
  })
}

/** Downloads download. */
async function download(url: string, limit: number, timeout = 45000, onHeaders?: (headers: Headers) => void) {
  const response = await net.fetch(url, { headers: { "User-Agent": "clash.meta Vessel" }, signal: AbortSignal.timeout(timeout) })
  if (!response.ok) throw new Error(`下载失败（HTTP ${response.status}）`)
  onHeaders?.(response.headers)
  const reader = response.body!.getReader(),
    chunks: Uint8Array[] = []
  let size = 0
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    size += value.length
    if (size > limit) {
      await reader.cancel()
      throw new Error("下载内容过大")
    }
    chunks.push(value)
  }
  return Buffer.concat(chunks)
}

/** Performs the core operation. */
async function core() {
  const asset = release.assets[`${process.platform}-${process.arch}` as keyof typeof release.assets]
  if (!asset) throw new Error("当前系统暂不支持内置代理核心")
  const path = join(directory(), `mihomo-${release.version}`)
  try {
    await readFile(path)
    return path
  } catch {
    /* First connection installs a pinned official core. */
  }
  state.stage = "正在下载代理核心…"
  const data = await download(asset.url, 80 * 1024 * 1024, 120000)
  if (createHash("sha256").update(data).digest("hex") !== asset.sha256) throw new Error("代理核心校验失败，请重试")
  await writeFile(path + ".tmp", gunzipSync(data, { maxOutputLength: 150 * 1024 * 1024 }), { mode: 0o700 })
  await chmod(path + ".tmp", 0o700)
  await rename(path + ".tmp", path)
  return path
}

/** Performs the api operation. */
async function api(route: string, method = "GET", body?: unknown) {
  const response = await fetch(`http://127.0.0.1:${controller}${route}`, { method, headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(3000) })
  if (!response.ok) throw new Error("代理核心暂不可用")
  return response.status === 204 ? undefined : response.json()
}

/** Disconnects disconnect. */
async function disconnect() {
  await loadRuntime()
  if (state.connected) await refreshTraffic(true)
  await persistTraffic().catch(() => {})
  tun = false
  const running = child
  child = undefined
  await setBrowserSessionProxy({ mode: "system" })
  running?.kill()
  state.connected = false
  state.subscriptionId = undefined
  state.stage = "未连接"
}

/** Performs the saved url operation. */
async function savedURL() {
  if (memoryURL) return memoryURL
  try {
    if (safeStorage.isEncryptionAvailable()) return safeStorage.decryptString(await readFile(join(directory(), "subscription.enc")))
  } catch {
    /* No saved subscription. */
  }
  return ""
}

/** Connects connect. */
async function connect(input?: string, profileId?: string) {
  if (!generalSettings().proxyEnabled) throw new Error("请先在通用配置开启代理")
  if (state.busy) throw new Error("正在处理，请稍候")
  state.busy = true
  state.error = undefined
  try {
    await loadRuntime()
    const url = input?.trim() || (await savedURL())
    if (!/^https?:\/\//i.test(url) || url.length > 8192) throw new Error("请粘贴有效的 Clash 订阅链接")
    await disconnect()
    await mkdir(directory(), { recursive: true, mode: 0o700 })
    state.stage = "正在读取订阅…"
    let info: BrowserProxySubscriptionInfo | undefined
    const source = (await download(url, 5 * 1024 * 1024, 45000, headers => { info = subscriptionInfo(headers.get("subscription-userinfo")) })).toString("utf8")
    if (profileId && info) await profiles().setInfo(profileId, info, url)
    const port = await freePort()
    controller = await freePort()
    secret = randomUUID()
    const config = browserProxyConfig(source, port, controller, secret, mode)
    const executable = await core()
    await writeFile(join(directory(), "config.yaml"), config, { mode: 0o600 })
    await chmod(join(directory(), "config.yaml"), 0o600)
    state.stage = "正在连接…"
    const processHandle = spawn(executable, ["-d", directory(), "-f", join(directory(), "config.yaml")], { stdio: "ignore", windowsHide: true })
    child = processHandle
    let failed = false
    processHandle.on("error", () => {
      failed = true
    })
    processHandle.on("exit", () => {
      failed = true
      if (child === processHandle) {
        void disconnect().catch(() => {})
        state.error = "代理核心已退出，请重新连接"
      }
    })
    let group: { all?: string[]; now?: string } | undefined
    for (let attempt = 0; attempt < 80 && !failed; attempt++) {
      try {
        group = await api("/proxies/Vessel")
        if (group?.all?.length) break
      } catch {
        /* Wait for local controller and providers. */
      }
      await pause(250)
    }
    if (failed || !group?.all?.length) throw new Error("代理核心启动失败或订阅没有可用节点")
    if (mode === "global") await api("/proxies/GLOBAL", "PUT", { name: "Vessel" })
    const previousTraffic = traffic.snapshot()
    traffic = new ProxyTrafficCounter(previousTraffic.totalUploaded, previousTraffic.totalDownloaded)
    await setBrowserSessionProxy({ proxyRules: `http=127.0.0.1:${port};https=127.0.0.1:${port}`, proxyBypassRules: "<local>" })
    memoryURL = url
    state.hasSubscription = true
    if (safeStorage.isEncryptionAvailable()) await writeFile(join(directory(), "subscription.enc"), safeStorage.encryptString(url), { mode: 0o600 })
    state.connected = true
    state.subscriptionId = profileId
    state.nodes = group.all
    state.selected = group.now || group.all[0]
    state.stage = "已连接，仅代理 Vessel 浏览器"
  } catch (error) {
    await disconnect()
    state.error = error instanceof Error ? error.message : "连接失败"
    throw new Error(state.error)
  } finally {
    state.busy = false
  }
  if (!generalSettings().proxyEnabled) await disconnect()
  return snapshot()
}
settingsEvents.on("changed", () => {
  if (!generalSettings().proxyEnabled) void disconnect().catch(() => {})
})
app.once("before-quit", () => child?.kill())
let saving = Promise.resolve()

let mode: BrowserProxyMode = "rule"
let tun = false
let traffic = new ProxyTrafficCounter()
let trafficError: string | undefined
let runtimeReady: Promise<void> | undefined
let trafficPending: Promise<void> | undefined
let lastSample = 0, lastSaved = 0
let statsSaving = Promise.resolve()
let permission: Promise<boolean> | undefined
function tunAvailable() {
  return permission ??= process.platform === "win32"
    ? new Promise<boolean>(resolve => execFile("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", "([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)"], { timeout: 3000, windowsHide: true }, (error, output) => resolve(!error && output.trim() === "True")))
    : Promise.resolve(process.getuid?.() === 0)
}
function loadRuntime() {
  return runtimeReady ??= (async () => {
    try {
      const options = JSON.parse(await readFile(join(directory(), "runtime.json"), "utf8"))
      if (["rule", "global", "direct"].includes(options.mode)) mode = options.mode
    } catch { /* Default is the existing browser-only rule mode. */ }
    try {
      const totals = JSON.parse(await readFile(join(directory(), "traffic.json"), "utf8"))
      if ([totals.upload, totals.download].every(value => Number.isFinite(value) && value >= 0)) traffic = new ProxyTrafficCounter(totals.upload, totals.download)
    } catch { /* First run has no recorded traffic. */ }
  })()
}
function persistTraffic() {
  const data = traffic.snapshot()
  statsSaving = statsSaving.catch(() => {}).then(async () => {
    await mkdir(directory(), { recursive: true, mode: 0o700 })
    const path = join(directory(), "traffic.json")
    await writeFile(path + ".tmp", JSON.stringify({ upload: data.totalUploaded, download: data.totalDownloaded }), { mode: 0o600 })
    await rename(path + ".tmp", path)
  })
  return statsSaving
}
function refreshTraffic(force = false): Promise<void> {
  if (!state.connected) return Promise.resolve()
  if (trafficPending) return trafficPending
  if (!force && Date.now() - lastSample < 900) return Promise.resolve()
  const current = child
  lastSample = Date.now()
  trafficPending = (async () => {
    try {
      const counters = await api("/connections")
      if (current !== child || !state.connected) return
      traffic.sample(counters.uploadTotal, counters.downloadTotal)
      trafficError = undefined
      if (Date.now() - lastSaved > 5000) { lastSaved = Date.now(); await persistTraffic() }
    } catch { trafficError = "暂时无法读取流量数据" }
  })().finally(() => { trafficPending = undefined })
  return trafficPending
}
async function snapshot(): Promise<BrowserProxyStatus> {
  await loadRuntime()
  await refreshTraffic()
  const available = await tunAvailable()
  return { ...state, runtime: { mode, tun, tunAvailable: available, tunReason: available ? undefined : "开启虚拟网卡需要管理员权限；当前进程未获得该权限。", traffic: traffic.snapshot(state.connected && !trafficError), trafficError } }
}
async function configureRuntime(input: { mode?: BrowserProxyMode; tun?: boolean }) {
  if (!input || input.mode !== undefined && !["rule", "global", "direct"].includes(input.mode) || input.tun !== undefined && typeof input.tun !== "boolean") throw new Error("代理配置无效")
  if (state.busy) throw new Error("正在处理，请稍候")
  if (!generalSettings().proxyEnabled) throw new Error("请先开启代理")
  if (input.tun && !await tunAvailable()) throw new Error("开启虚拟网卡需要管理员权限")
  if (input.tun !== undefined && !state.connected) throw new Error("请先连接订阅")
  await loadRuntime()
  state.busy = true
  const before = { mode, tun }
  try {
    const patch: Record<string, unknown> = {}
    if (input.mode) patch.mode = input.mode
    if (input.tun !== undefined) patch.tun = { enable: input.tun, stack: "mixed", "auto-route": true, "auto-detect-interface": true }
    if (state.connected) {
      await api("/configs", "PATCH", patch)
      if (input.mode === "global") await api("/proxies/GLOBAL", "PUT", { name: "Vessel" })
      const actual = await api("/configs")
      if (input.tun !== undefined && !!actual.tun?.enable !== input.tun) throw new Error("虚拟网卡未能启用，请检查系统权限与代理核心日志")
      if (input.mode && actual.mode !== input.mode) throw new Error("出站模式未能生效")
    }
    if (input.mode) mode = input.mode
    if (input.tun !== undefined) tun = input.tun
    await mkdir(directory(), { recursive: true, mode: 0o700 })
    await writeFile(join(directory(), "runtime.json"), JSON.stringify({ mode }), { mode: 0o600 })
    state.stage = state.connected ? tun ? "已连接，虚拟网卡已开启" : "已连接，仅代理 Vessel 浏览器" : "未连接"
  } catch (error) {
    if (state.connected) await api("/configs", "PATCH", { mode: before.mode, tun: { enable: before.tun } }).catch(() => {})
    mode = before.mode; tun = before.tun
    throw error
  } finally { state.busy = false }
  return snapshot()
}

let subscriptions: ProxySubscriptions | undefined
const profiles = () => subscriptions ??= new ProxySubscriptions(join(directory(), "subscriptions.enc"), safeStorage, savedURL)

/** Registers browser proxy. */
export function registerBrowserProxy(host: WebContents) {
  host.ipc.handle("browser:proxy:runtime", (_event, input: { mode?: BrowserProxyMode; tun?: boolean }) => configureRuntime(input))
  host.ipc.handle("browser:proxy:profile-info", async (_event, id: string) => {
    const profile = (await profiles().list()).find(item => item.id === id)
    if (!profile) throw new Error("请选择有效订阅")
    let info = subscriptionInfo(null)
    await download(profile.url, 5 * 1024 * 1024, 45000, headers => { info = subscriptionInfo(headers.get("subscription-userinfo")) })
    return profiles().setInfo(id, info, profile.url)
  })
  host.ipc.handle("browser:proxy:profiles", () => profiles().list())
  host.ipc.handle("browser:proxy:profile-save", (_event, input: { id?: string; name: string; url: string }) => {
    if (state.busy || state.connected && input?.id === state.subscriptionId) throw new Error("请先断开连接，再编辑订阅")
    return profiles().save(input)
  })
  host.ipc.handle("browser:proxy:profile-delete", async (_event, id: string) => {
    if (typeof id !== "string") throw new Error("订阅无效")
    if (state.busy || state.connected && state.subscriptionId === id) throw new Error("请先断开连接，再删除订阅")
    await profiles().remove(id)
  })
  host.ipc.handle("browser:proxy:profile-connect", async (_event, id: string) => {
    const profile = (await profiles().list()).find(item => item.id === id)
    if (!profile) throw new Error("请选择有效订阅")
    return connect(profile.url, id)
  })
  host.ipc.handle("browser:proxy:subscription", () => savedURL())
  host.ipc.handle("browser:proxy:save", (_event, value: string) => {
    if (typeof value !== "string" || value.length > 8192) throw new Error("订阅链接无效")
    memoryURL = value
    saving = saving
      .catch(() => {})
      .then(async () => {
        await mkdir(directory(), { recursive: true, mode: 0o700 })
        if (safeStorage.isEncryptionAvailable()) await writeFile(join(directory(), "subscription.enc"), safeStorage.encryptString(value), { mode: 0o600 })
      })
    return saving
  })
  host.ipc.handle("browser:proxy:status", () => snapshot())
  host.ipc.handle("browser:proxy:connect", (_event, url?: string) => connect(url))
  host.ipc.handle("browser:proxy:disconnect", async () => {
    if (state.busy) throw new Error("正在连接，请稍候")
    await disconnect()
    return snapshot()
  })
  host.ipc.handle("browser:proxy:select", async (_event, name: string) => {
    if (!state.connected || !state.nodes.includes(name)) throw new Error("节点无效")
    await api("/proxies/Vessel", "PUT", { name })
    state.selected = name
    await closeBrowserSessionConnections()
    return snapshot()
  })
}
