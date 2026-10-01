import type { WebContents } from "electron"
import { realpath, stat } from "node:fs/promises"
import { dirname, relative, isAbsolute, sep } from "node:path"
import { randomUUID } from "node:crypto"
import { spawn, type IPty } from "node-pty"

export async function terminalDirectory(root: string, file?: string) {
  if (typeof root !== "string" || !isAbsolute(root) || (file !== undefined && (typeof file !== "string" || !isAbsolute(file)))) throw new Error("终端路径无效")
  const base = await realpath(root)
  const target = file ? await realpath(file) : base
  const offset = relative(base, target)
  if (offset === ".." || offset.startsWith(".." + sep) || isAbsolute(offset)) throw new Error("终端目录必须位于当前工作区")
  const cwd = (await stat(target)).isDirectory() ? target : dirname(target)
  return cwd
}
export function registerTerminal(host: WebContents) {
  const sessions = new Map<string, IPty>()
  const close = (id: string) => { const terminal = sessions.get(id); sessions.delete(id); terminal?.kill() }
  host.ipc.handle("terminal:start", async (_event, root: string, file?: string) => {
    const cwd = await terminalDirectory(root, file)
    if (host.isDestroyed()) throw new Error("窗口已关闭")
    if (sessions.size >= 8) throw new Error("最多同时打开 8 个终端")
    const shell = process.platform === "win32" ? "powershell.exe" : process.env.SHELL || "/bin/zsh"
    const env = Object.fromEntries(Object.entries(process.env).filter(([key, value]) => value !== undefined && key !== "ELECTRON_RUN_AS_NODE")) as Record<string, string>
    const terminal = spawn(shell, process.platform === "win32" ? ["-NoLogo"] : ["-l"], { cwd, env, name: "xterm-256color", cols: 80, rows: 24 })
    const id = randomUUID()
    sessions.set(id, terminal)
    terminal.onData(data => { if (!host.isDestroyed()) host.send("terminal:data", id, data) })
    terminal.onExit(({ exitCode }) => { sessions.delete(id); if (!host.isDestroyed()) host.send("terminal:data", id, `\r\n[进程退出：${exitCode}]\r\n`) })
    return { id, cwd }
  })
  host.ipc.handle("terminal:write", (_event, id: string, data: string) => { if (typeof data === "string" && data.length <= 1024 * 1024) sessions.get(id)?.write(data) })
  host.ipc.handle("terminal:resize", (_event, id: string, cols: number, rows: number) => {
    if (Number.isInteger(cols) && Number.isInteger(rows) && cols > 0 && rows > 0 && cols < 1000 && rows < 1000) sessions.get(id)?.resize(cols, rows)
  })
  host.ipc.handle("terminal:close", (_event, id: string) => close(id))
  host.once("destroyed", () => { for (const id of sessions.keys()) close(id) })
  host.on("did-start-navigation", (_event, _url, inPlace, mainFrame) => { if (mainFrame && !inPlace) for (const id of sessions.keys()) close(id) })
}
