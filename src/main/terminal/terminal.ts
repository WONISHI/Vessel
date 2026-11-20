import type { WebContents } from "electron"
import { spawn, type IPty } from "node-pty"
import { randomUUID } from "node:crypto"
import { realpath, stat } from "node:fs/promises"
import { dirname, isAbsolute, relative, sep } from "node:path"
import { terminateTerminalTree } from "./process-tree"

const terminalHosts = new Set<() => void>()
let quitting = false

/** Runs before application teardown, while every pty and its process ancestry still exist. */
export function closeAllTerminals() {
  quitting = true
  for (const close of terminalHosts) close()
}

/** A failed file-save drain can abort quitting and leave the application open. */
export function resumeTerminalStarts() { quitting = false }

/** Performs the terminal directory operation. */
export async function terminalDirectory(root: string, file?: string) {
  if (typeof root !== "string" || !isAbsolute(root) || (file !== undefined && (typeof file !== "string" || !isAbsolute(file)))) throw new Error("终端路径无效")
  const base = await realpath(root)
  const target = file ? await realpath(file) : base
  const offset = relative(base, target)
  if (offset === ".." || offset.startsWith(".." + sep) || isAbsolute(offset)) throw new Error("终端目录必须位于当前工作区")
  const cwd = (await stat(target)).isDirectory() ? target : dirname(target)
  return cwd
}

/** Registers terminal. */
export function registerTerminal(host: WebContents) {
  const sessions = new Map<string, IPty>()
  let disposed = false
  let revision = 0

  /** Closes close. */
  const close = (id: string) => {
    const terminal = sessions.get(id)
    sessions.delete(id)
    if (terminal) terminateTerminalTree(terminal)
  }
  const closeAll = () => {
    revision++
    for (const id of sessions.keys()) close(id)
  }
  terminalHosts.add(closeAll)
  host.ipc.handle("terminal:start", async (_event, root: string, file?: string, cols?: number, rows?: number) => {
    const startedAt = revision
    if (quitting || disposed) throw new Error("窗口正在关闭")
    const cwd = await terminalDirectory(root, file)
    if (quitting || disposed || host.isDestroyed() || startedAt !== revision) throw new Error("窗口已关闭或正在重新加载")
    if (sessions.size >= 64) throw new Error("最多同时打开 64 个终端")
    const shell = process.platform === "win32" ? "powershell.exe" : process.env.SHELL || "/bin/zsh"
    const env: Record<string, string> = {
      PROMPT_EOL_MARK: "",
      ...(Object.fromEntries(Object.entries(process.env).filter(([key, value]) => value !== undefined && key !== "ELECTRON_RUN_AS_NODE")) as Record<string, string>)
    }
    const initialCols = Number.isInteger(cols) && cols! > 0 && cols! < 1000 ? cols! : 80
    const initialRows = Number.isInteger(rows) && rows! > 0 && rows! < 1000 ? rows! : 24
    const terminal = spawn(shell, process.platform === "win32" ? ["-NoLogo"] : ["-l"], { cwd, env, name: "xterm-256color", cols: initialCols, rows: initialRows })
    const id = randomUUID()
    sessions.set(id, terminal)
    terminal.onData((data) => {
      if (!host.isDestroyed()) host.send("terminal:data", id, data)
    })
    terminal.onExit(({ exitCode }) => {
      sessions.delete(id)
      if (!host.isDestroyed()) host.send("terminal:data", id, `\r\n[进程退出：${exitCode}]\r\n`)
    })
    return { id, cwd }
  })
  host.ipc.handle("terminal:write", (_event, id: string, data: string) => {
    if (typeof data === "string" && data.length <= 1024 * 1024) sessions.get(id)?.write(data)
  })
  host.ipc.handle("terminal:resize", (_event, id: string, cols: number, rows: number) => {
    if (Number.isInteger(cols) && Number.isInteger(rows) && cols > 0 && rows > 0 && cols < 1000 && rows < 1000) {
      const pty = sessions.get(id)
      if (pty && (pty.cols !== cols || pty.rows !== rows)) pty.resize(cols, rows)
    }
  })
  host.ipc.handle("terminal:close", (_event, id: string) => close(id))
  host.once("destroyed", () => {
    disposed = true
    closeAll()
    terminalHosts.delete(closeAll)
  })
  host.on("did-start-navigation", (_event, _url, inPlace, mainFrame) => {
    if (mainFrame && !inPlace) closeAll()
  })
}
