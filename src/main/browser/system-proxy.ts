import { execFile } from "node:child_process"
import { mkdir, readFile, rename, unlink, writeFile } from "node:fs/promises"
import { dirname } from "node:path"

type Proxy = { enabled: boolean; server: string; port: number }
type Backup = { port: number; services: { name: string; web: Proxy; secureweb: Proxy }[] }
type Run = (args: string[]) => Promise<string>
const runNetworksetup: Run = args => new Promise((resolve, reject) => {
  execFile("/usr/sbin/networksetup", args, { timeout: 15000, env: { ...process.env, LC_ALL: "C", LANG: "C" } }, (error, stdout) => {
    if (error || /Error:|You need administrator|not a recognized/i.test(stdout)) reject(new Error("无法修改系统代理，请检查系统网络设置权限"))
    else resolve(stdout)
  })
})

function parseProxy(text: string): Proxy {
  const enabled = /^Enabled: (Yes|No)$/m.exec(text)?.[1]
  const server = /^Server: ?(.*)$/m.exec(text)?.[1]
  const port = Number(/^Port: (\d+)$/m.exec(text)?.[1])
  if (!enabled || server === undefined || !Number.isInteger(port) || port < 0 || port > 65535) throw new Error("无法读取系统代理配置")
  // networksetup cannot retrieve saved authentication credentials for restoration.
  if (/Authenticated Proxy Enabled: (1|Yes)/i.test(text)) throw new Error("现有系统代理需要身份认证，请先在系统设置中关闭认证，或选择代理 Vessel 浏览器")
  return { enabled: enabled === "Yes", server, port }
}

/** System HTTP(S) proxy, with a durable backup for disconnect and crash recovery. */
export class SystemProxy {
  private queue: Promise<unknown> = Promise.resolve()
  constructor(private path: string, private run: Run = runNetworksetup, private platform: string = process.platform) {}
  private serial<T>(action: () => Promise<T>): Promise<T> {
    const next = this.queue.catch(() => {}).then(action)
    this.queue = next
    return next
  }
  private async readBackup(): Promise<Backup | undefined> {
    let content: string
    try { content = await readFile(this.path, "utf8") }
    catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return; throw error }
    const value = JSON.parse(content) as Backup
    if (!Number.isInteger(value.port) || value.port < 1 || value.port > 65535 || !Array.isArray(value.services) || !value.services.every(service =>
      typeof service.name === "string" && [service.web, service.secureweb].every(proxy => proxy && typeof proxy.enabled === "boolean" && typeof proxy.server === "string" && Number.isInteger(proxy.port) && proxy.port >= 0 && proxy.port <= 65535))) throw new Error("系统代理恢复记录无效")
    return value
  }
  private async restoreBackup() {
    const backup = await this.readBackup()
    if (!backup) return
    if (this.platform !== "darwin") throw new Error("当前系统不支持恢复此代理记录")
    for (const service of backup.services) for (const kind of ["web", "secureweb"] as const) {
      const current = parseProxy(await this.run([`-get${kind}proxy`, service.name]))
      // Do not overwrite a proxy changed by the user or another application.
      if (current.server !== "127.0.0.1" || current.port !== backup.port) continue
      const previous = service[kind]
      if (previous.server && previous.port) await this.run([`-set${kind}proxy`, service.name, previous.server, String(previous.port), "off"])
      await this.run([`-set${kind}proxystate`, service.name, previous.enabled ? "on" : "off"])
    }
    await unlink(this.path)
  }
  restore() { return this.serial(() => this.restoreBackup()) }
  enable(port: number) {
    return this.serial(async () => {
      if (this.platform !== "darwin") throw new Error("当前系统暂不支持设置系统代理，请选择代理 Vessel 浏览器")
      if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("系统代理端口无效")
      await this.restoreBackup()
      const names = (await this.run(["-listallnetworkservices"])).split(/\r?\n/).slice(1).filter(name => name && !name.startsWith("*"))
      if (!names.length) throw new Error("未找到可配置系统代理的网络服务")
      const services: Backup["services"] = []
      for (const name of names) {
        // Leave PAC, discovery and SOCKS settings untouched rather than silently competing with them.
        for (const option of ["-getautoproxyurl", "-getproxyautodiscovery", "-getsocksfirewallproxy"]) {
          if (/Enabled: Yes|Auto Proxy Discovery: On/i.test(await this.run([option, name]))) throw new Error("系统已启用自动代理或 SOCKS，请先关闭，或选择代理 Vessel 浏览器")
        }
        services.push({ name, web: parseProxy(await this.run(["-getwebproxy", name])), secureweb: parseProxy(await this.run(["-getsecurewebproxy", name])) })
      }
      await mkdir(dirname(this.path), { recursive: true, mode: 0o700 })
      await writeFile(this.path + ".tmp", JSON.stringify({ port, services }), { mode: 0o600 })
      await rename(this.path + ".tmp", this.path)
      try {
        for (const service of services) for (const kind of ["web", "secureweb"]) {
          await this.run([`-set${kind}proxy`, service.name, "127.0.0.1", String(port), "off"])
          const actual = parseProxy(await this.run([`-get${kind}proxy`, service.name]))
          if (!actual.enabled || actual.server !== "127.0.0.1" || actual.port !== port) throw new Error("系统代理未能生效")
        }
      } catch (error) {
        try { await this.restoreBackup() }
        catch { throw new Error("设置系统代理失败，且原设置尚未恢复，请检查系统网络设置后重试断开") }
        throw error
      }
    })
  }
}
