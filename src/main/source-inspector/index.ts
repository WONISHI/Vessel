import { app, dialog, ipcMain } from "electron"
import { execFile, spawn, type ChildProcess } from "node:child_process"
import { mkdtemp, realpath, rm, stat, writeFile } from "node:fs/promises"
import { promisify } from "node:util"
import { tmpdir } from "node:os"
import { dirname, delimiter, join, isAbsolute, relative, sep } from "node:path"
import { openProjectInEditor } from "@main/files/open-project-editor"
import runner from "./runner.mjs?raw"
import client from "./client.js?raw"

type Service = { root: string; url: string; logs: string; child: ChildProcess; directory: string }
let service: Service | undefined
let starting = false
const snapshot = () => service ? { root: service.root, url: service.url, logs: service.logs, running: !!service.child.pid && service.child.exitCode === null && service.child.signalCode === null && !service.child.killed } : null

export async function stopSourceProject() {
  const current = service
  if (!current) return
  // Keep the service registered until exit; a subsequent start cannot race its port.
  await new Promise<void>((resolve) => {
    if (!current.child.pid || current.child.exitCode !== null || current.child.signalCode !== null) return resolve()
    const force = setTimeout(() => current.child.kill("SIGKILL"), 4000)
    current.child.once("exit", () => { clearTimeout(force); resolve() })
    current.child.kill("SIGTERM")
  })
  if (service === current) service = undefined
  await rm(current.directory, { recursive: true, force: true })
}

async function start(options: { root?: unknown; config?: unknown; mode?: unknown; port?: unknown }) {
  if (starting) throw new Error("开发服务正在启动，请稍候")
  starting = true
  try {
    if (typeof options?.root !== "string" || !isAbsolute(options.root)) throw new Error("请选择本地项目目录")
    const root = await realpath(options.root)
    if (!(await stat(root)).isDirectory()) throw new Error("项目目录无效")
    const config = typeof options.config === "string" ? options.config.trim() : ""
    if (config) {
      const file = await realpath(join(root, config)), offset = relative(root, file)
      if (isAbsolute(offset) || offset === ".." || offset.startsWith(`..${sep}`)) throw new Error("配置文件必须位于项目目录内")
    }
    const port = Number(options.port || 0)
    if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error("端口应为 1–65535，或留空使用项目配置")
    await stopSourceProject()
    const directory = await mkdtemp(join(tmpdir(), "vessel-source-"))
    await Promise.all([writeFile(join(directory, "runner.mjs"), runner), writeFile(join(directory, "client.js"), client)])
    // Finder-launched macOS apps may not inherit Volta/nvm's login PATH.
    let node = "node"
    if (process.platform !== "win32") {
      try {
        const { stdout } = await promisify(execFile)(process.env.SHELL || "/bin/zsh", ["-lc", "command -v node"], { cwd: root, timeout: 5000 })
        const candidate = stdout.trim().split("\n").at(-1) || ""
        if (isAbsolute(candidate)) node = candidate
      } catch { /* Fall back to the app's inherited PATH. */ }
    }
    const child = spawn(node, [join(directory, "runner.mjs"), JSON.stringify({ config, mode: typeof options.mode === "string" ? options.mode.trim() : "development", port })], { cwd: root, env: { ...process.env, ...(isAbsolute(node) ? { PATH: `${dirname(node)}${delimiter}${process.env.PATH || ""}` } : {}), ELECTRON_RUN_AS_NODE: undefined }, stdio: ["ignore", "pipe", "pipe", "ipc"], windowsHide: true })
    const current: Service = { root, url: "", logs: "", child, directory }
    service = current
    const log = (chunk: Buffer) => { current.logs = (current.logs + chunk.toString()).slice(-16000) }
    child.stdout?.on("data", log); child.stderr?.on("data", log)
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`启动超时，请检查 Node 版本、项目依赖和 Vite 配置。\n${current.logs}`)), 45000)
      const fail = (error: Error) => { clearTimeout(timer); reject(error) }
      child.once("error", error => fail(new Error(`无法启动 Node：${error.message}，请确认 Node 已安装并可从 PATH 访问`)))
      child.once("exit", code => { if (!current.url) fail(new Error(`开发服务退出（${code}）\n${current.logs}`)) })
      child.on("message", async (message: any) => {
        if (message.type === "ready") { current.url = message.url; clearTimeout(timer); resolve() }
        if (message.type === "error") fail(new Error(message.error))
        if (message.type === "open") {
          let error: string | undefined
          try { await openProjectInEditor(root, message.file, message.line, message.column) }
          catch (cause) { error = String(cause) }
          if (child.connected) child.send({ type: "opened", requestId: message.requestId, error }, () => {})
        }
      })
    }).catch(async error => { await stopSourceProject(); throw error })
    return snapshot()
  } finally { starting = false }
}

export function registerSourceInspector() {
  ipcMain.handle("source-project:pick", async () => {
    const result = await dialog.showOpenDialog({ title: "选择 Vue 3 + Vite 项目目录", properties: ["openDirectory"] })
    return result.canceled ? null : result.filePaths[0]
  })
  ipcMain.handle("source-project:start", (_event, options) => start(options))
  ipcMain.handle("source-project:status", () => snapshot())
  ipcMain.handle("source-project:stop", () => stopSourceProject())
  app.on("will-quit", disposeSourceInspector)
}
export function disposeSourceInspector() {
  for (const channel of ["pick", "start", "status", "stop"]) ipcMain.removeHandler(`source-project:${channel}`)
  app.off("will-quit", disposeSourceInspector)
  void stopSourceProject()
}
