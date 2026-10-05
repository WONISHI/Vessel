import { app, net, safeStorage, session, type WebContents } from "electron"
import { spawn, type ChildProcess } from "node:child_process"
import { mkdir, readFile, writeFile, chmod, rename } from "node:fs/promises"
import { join } from "node:path"
import { createHash, randomUUID } from "node:crypto"
import { gunzipSync } from "node:zlib"
import { createServer } from "node:net"
import release from "./mihomo-release.json"
import { browserProxyConfig } from "./browser-proxy-config"
import type { BrowserProxyStatus } from "../shared/browser-proxy"
const state: BrowserProxyStatus = { connected: false, busy: false, stage: "未连接", nodes: [], selected: "", hasSubscription: false }
let child: ChildProcess | undefined,
  controller = 0,
  secret = "",
  memoryURL = ""
const directory = () => join(app.getPath("userData"), "browser-proxy")
const browser = () => session.fromPartition("persist:vessel-browser")
const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
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
async function download(url: string, limit: number, timeout = 45000) {
  const response = await net.fetch(url, { headers: { "User-Agent": "clash.meta Vessel" }, signal: AbortSignal.timeout(timeout) })
  if (!response.ok) throw new Error(`下载失败（HTTP ${response.status}）`)
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
async function api(route: string, method = "GET", body?: unknown) {
  const response = await fetch(`http://127.0.0.1:${controller}${route}`, { method, headers: { Authorization: `Bearer ${secret}`, "Content-Type": "application/json" }, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(3000) })
  if (!response.ok) throw new Error("代理核心暂不可用")
  return response.status === 204 ? undefined : response.json()
}
async function disconnect() {
  const running = child
  child = undefined
  await browser().setProxy({ mode: "system" })
  await browser().closeAllConnections()
  running?.kill()
  state.connected = false
  state.nodes = []
  state.selected = ""
  state.stage = "未连接"
}
async function savedURL() {
  if (memoryURL) return memoryURL
  try {
    if (safeStorage.isEncryptionAvailable()) return safeStorage.decryptString(await readFile(join(directory(), "subscription.enc")))
  } catch {
    /* No saved subscription. */
  }
  return ""
}
async function connect(input?: string) {
  if (state.busy) throw new Error("正在处理，请稍候")
  state.busy = true
  state.error = undefined
  try {
    const url = input?.trim() || (await savedURL())
    if (!/^https?:\/\//i.test(url) || url.length > 8192) throw new Error("请粘贴有效的 Clash 订阅链接")
    await disconnect()
    await mkdir(directory(), { recursive: true, mode: 0o700 })
    state.stage = "正在读取订阅…"
    const source = (await download(url, 5 * 1024 * 1024)).toString("utf8")
    const port = await freePort()
    controller = await freePort()
    secret = randomUUID()
    const config = browserProxyConfig(source, port, controller, secret)
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
    await browser().setProxy({ proxyRules: `http=127.0.0.1:${port};https=127.0.0.1:${port}`, proxyBypassRules: "<local>" })
    await browser().closeAllConnections()
    memoryURL = url
    state.hasSubscription = true
    if (safeStorage.isEncryptionAvailable()) await writeFile(join(directory(), "subscription.enc"), safeStorage.encryptString(url), { mode: 0o600 })
    state.connected = true
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
  return { ...state }
}
app.once("before-quit", () => child?.kill())
export function registerBrowserProxy(host: WebContents) {
  host.ipc.handle("browser:proxy:status", async () => ({ ...state, hasSubscription: !!(await savedURL()) }))
  host.ipc.handle("browser:proxy:connect", (_event, url?: string) => connect(url))
  host.ipc.handle("browser:proxy:disconnect", async () => {
    if (state.busy) throw new Error("正在连接，请稍候")
    await disconnect()
    return { ...state }
  })
  host.ipc.handle("browser:proxy:select", async (_event, name: string) => {
    if (!state.connected || !state.nodes.includes(name)) throw new Error("节点无效")
    await api("/proxies/Vessel", "PUT", { name })
    state.selected = name
    await browser().closeAllConnections()
    return { ...state }
  })
}
