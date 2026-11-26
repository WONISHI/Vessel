import { afterEach, expect, it, vi } from "vitest"
import { mkdtemp, readFile, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { SystemProxy } from "../../src/main/browser/system-proxy"

let directory = ""
afterEach(async () => { if (directory) await rm(directory, { recursive: true, force: true }) })
async function fixture() {
  directory = await mkdtemp(join(tmpdir(), "vessel-system-proxy-"))
  const original = { enabled: true, server: "old.example", port: 8888 }
  const values: Record<string, typeof original> = { web: { ...original }, secureweb: { ...original } }
  const run = vi.fn(async (args: string[]) => {
    const [option, , server, port] = args
    if (option === "-listallnetworkservices") return "An asterisk (*) denotes disabled services.\nWi-Fi\n*Disabled\n"
    if (["-getautoproxyurl", "-getproxyautodiscovery", "-getsocksfirewallproxy"].includes(option)) return "Enabled: No"
    const match = /^-(get|set)(secureweb|web)proxy(state)?$/.exec(option)!
    const [, action, kind, state] = match
    if (action === "get") return `Enabled: ${values[kind].enabled ? "Yes" : "No"}\nServer: ${values[kind].server}\nPort: ${values[kind].port}\nAuthenticated Proxy Enabled: 0\n`
    if (state) values[kind].enabled = server === "on"
    else values[kind] = { enabled: true, server, port: Number(port) }
    return ""
  })
  const path = join(directory, "backup.json")
  return { original, values, run, path, proxy: new SystemProxy(path, run, "darwin") }
}
it("backs up before changing HTTP(S), restores after restart, and skips disabled services", async () => {
  const { proxy, run, path, values, original } = await fixture()
  await proxy.enable(12345)
  expect(JSON.parse(await readFile(path, "utf8")).services).toHaveLength(1)
  expect(values.web).toEqual({ enabled: true, server: "127.0.0.1", port: 12345 })
  await new SystemProxy(path, run, "darwin").restore()
  expect(values).toEqual({ web: original, secureweb: original })
  await expect(readFile(path)).rejects.toMatchObject({ code: "ENOENT" })
})
it("rolls back partially applied changes when a system command fails", async () => {
  const { proxy, run, values, original } = await fixture()
  const implementation = run.getMockImplementation()!
  run.mockImplementation(async args => {
    if (args[0] === "-setsecurewebproxy" && args[2] === "127.0.0.1") throw new Error("permission denied")
    return implementation(args)
  })
  await expect(proxy.enable(12345)).rejects.toThrow("permission denied")
  expect(values).toEqual({ web: original, secureweb: original })
})
it("preserves proxy settings subsequently changed by another application", async () => {
  const { proxy, values, original } = await fixture()
  await proxy.enable(12345)
  values.web = { enabled: true, server: "other.example", port: 8000 }
  await proxy.restore()
  expect(values.web.server).toBe("other.example")
  expect(values.secureweb).toEqual(original)
})
it("rejects competing automatic proxies before changing any settings", async () => {
  const { proxy, run, values, original } = await fixture()
  run.mockResolvedValueOnce("Header\nWi-Fi\n").mockResolvedValueOnce("Enabled: Yes")
  await expect(proxy.enable(12345)).rejects.toThrow("自动代理")
  expect(values.web).toEqual(original)
})
