import { EventEmitter } from "node:events"
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { createConnection } from "node:net"
import { expect, it } from "vitest"
import { closeAllTerminals, registerTerminal, resumeTerminalStarts } from "@main/terminal/terminal"

const quote = (value: string) => "'" + value.replace(/'/g, "'\\''") + "'"
const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))
const listening = (port: number) => new Promise<boolean>(resolve => {
  const socket = createConnection({ host: "127.0.0.1", port })
  socket.on("connect", () => { socket.destroy(); resolve(true) })
  socket.on("error", () => resolve(false))
  socket.setTimeout(500, () => { socket.destroy(); resolve(false) })
})

it.skipIf(process.platform === "win32")("terminates workspace/resource commands and their separate-process-group descendants without killing another window", async () => {
  const root = await mkdtemp(join(tmpdir(), "vessel-terminal-cleanup-"))
  const worker = join(root, "worker.cjs")
  const hosts: EventEmitter[] = []
  const processes: { pid: number; port: number }[] = []
  const makeHost = () => {
    const handlers = new Map<string, (...args: any[]) => any>()
    const host = Object.assign(new EventEmitter(), { ipc: { handle: (name: string, handler: (...args: any[]) => any) => handlers.set(name, handler) }, isDestroyed: () => false, send: () => undefined })
    hosts.push(host)
    registerTerminal(host as any)
    return { host, handlers }
  }
  try {
    resumeTerminalStarts()
    await writeFile(worker, `const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),{spawn}=require('node:child_process');
const [directory,role]=process.argv.slice(2);process.on('SIGHUP',()=>{});process.on('SIGTERM',()=>{});
if(role!=='grandchild')spawn(process.execPath,[__filename,directory,role==='parent'?'child':'grandchild'],{detached:true,stdio:'ignore',env:{...process.env,ELECTRON_RUN_AS_NODE:'1'}});
const server=http.createServer((_,response)=>response.end('alive'));server.listen(0,'127.0.0.1',()=>fs.writeFileSync(path.join(directory,role+'.json'),JSON.stringify({pid:process.pid,port:server.address().port})));
`)
    const first = makeHost(), second = makeHost()
    for (const [name, owner] of [["workspace", first], ["resources", first], ["other-window", second]] as const) {
      const directory = join(root, name)
      await mkdir(directory)
      const session = await owner.handlers.get("terminal:start")!({}, directory)
      owner.handlers.get("terminal:write")!({}, session.id, `ELECTRON_RUN_AS_NODE=1 ${quote(process.execPath)} ${quote(worker)} ${quote(directory)} parent\r`)
      for (const role of ["parent", "child", "grandchild"]) {
        let value: { pid: number; port: number } | undefined
        for (let attempt = 0; attempt < 100; attempt++) {
          try { value = JSON.parse(await readFile(join(directory, role + ".json"), "utf8")); break } catch { await delay(30) }
        }
        if (!value) throw new Error(`fixture not ready: ${name}/${role}`)
        processes.push(value)
        expect(await listening(value.port)).toBe(true)
      }
    }
    first.host.emit("destroyed")
    await expect.poll(async () => (await Promise.all(processes.slice(0, 6).map(value => listening(value.port)))).some(Boolean)).toBe(false)
    expect(await listening(processes[6].port)).toBe(true)
    closeAllTerminals()
    await expect.poll(async () => (await Promise.all(processes.map(value => listening(value.port)))).some(Boolean)).toBe(false)
    await expect(second.handlers.get("terminal:start")!({}, root)).rejects.toThrow("正在关闭")
  } finally {
    for (const host of hosts) host.emit("destroyed")
    for (const value of processes) { try { process.kill(value.pid, "SIGKILL") } catch { /* The fixture has already exited. */ } }
    resumeTerminalStarts()
    await rm(root, { recursive: true, force: true })
  }
}, 15000)
