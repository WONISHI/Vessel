import { app, safeStorage, type WebContents } from "electron"
import { readFileSync, existsSync } from "node:fs"
import { readFile, writeFile, rename, mkdtemp, rm, readdir, stat } from "node:fs/promises"
import { join, relative } from "node:path"
import { tmpdir } from "node:os"
import { gzipSync } from "node:zlib"
import Database from "better-sqlite3"
import { defaultSettings, type AppSettings, type BackupStatus } from "../shared/settings"
import { requestS3 } from "./settings-s3"
let stored: { settings: AppSettings; secret: string; status: BackupStatus } | undefined
let timer: ReturnType<typeof setInterval> | undefined
let activeHost: WebContents | undefined
const file = () => join(app.getPath("userData"), "settings.json")
function load() {
  if (!stored) {
    stored = { settings: structuredClone(defaultSettings), secret: "", status: { running: false } }
    if (existsSync(file())) {
      const parsed = JSON.parse(readFileSync(file(), "utf8"))
      stored = { settings: validate(parsed.settings), secret: typeof parsed.secret === "string" ? parsed.secret : "", status: { ...parsed.status, running: false } }
    }
  }
  return stored!
}
function validate(value: AppSettings): AppSettings {
  if (!value || !value.backup) throw new Error("设置格式无效")
  if (!["light", "dark", "system"].includes(value.theme) || ![5, 10, 30].includes(value.backup.minutes) || !Number.isInteger(value.fontSize) || value.fontSize < 12 || value.fontSize > 18) throw new Error("设置选项无效")
  if (!["Plus Jakarta Sans", "Inter", "system-ui", "PingFang SC", "Georgia"].includes(value.font) || !/^#[0-9a-f]{6}$/i.test(value.accent)) throw new Error("外观设置无效")
  const text = (v: string, max = 2048) => { if (typeof v !== "string" || v.length > max) throw new Error("设置文本过长或无效"); return v.trim() }
  const avatar = text(value.avatar, 3_000_000)
  if (avatar && !/^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/.test(avatar)) throw new Error("头像格式无效")
  return { name: text(value.name, 80) || "本地用户", email: text(value.email, 254), avatar, theme: value.theme, font: value.font, fontSize: value.fontSize, accent: value.accent, backup: { endpoint: text(value.backup.endpoint), accessKey: text(value.backup.accessKey), bucket: text(value.backup.bucket), region: text(value.backup.region), prefix: text(value.backup.prefix), automatic: value.backup.automatic === true, minutes: value.backup.minutes, hasSecret: false } }
}
function publicSettings() { const state = load(); return { ...state.settings, backup: { ...state.settings.backup, hasSecret: !!state.secret } } }
const decrypt = () => load().secret ? safeStorage.decryptString(Buffer.from(load().secret, "base64")) : ""
async function persist(next: NonNullable<typeof stored>) { const path = file() + ".tmp"; await writeFile(path, JSON.stringify(next), { mode: 0o600 }); await rename(path, file()); stored = next }
async function snapshot(): Promise<Uint8Array> {
  const state = load()
  const directory = await mkdtemp(join(tmpdir(), "vessel-backup-"))
  const entries: Array<{ path: string; data: string }> = []
  const roots = new Set<string>()
  let size = 0
  const add = async (path: string, name: string) => { const info = await stat(path); size += info.size; if (size > 256 * 1024 * 1024) throw new Error("备份数据超过 256 MB，请缩小工作区范围后重试"); entries.push({ path: name, data: (await readFile(path)).toString("base64") }) }
  try {
    for (const name of ["vessel.db", "todos.sqlite"]) {
      const source = join(app.getPath("userData"), name)
      if (!existsSync(source)) continue
      const db = new Database(source, { readonly: true, fileMustExist: true })
      try {
        if (name === "vessel.db") {
          for (const row of db.prepare("SELECT path FROM workspaces").all() as { path: string }[]) roots.add(row.path)
          const row = db.prepare("SELECT value_json FROM app_state WHERE key = 'project-library'").get() as { value_json: string } | undefined
          if (row) for (const project of JSON.parse(row.value_json)) if (typeof project.path === "string") roots.add(project.path)
        }
        await db.backup(join(directory, name))
      } finally { db.close() }
      await add(join(directory, name), `database/${name}`)
    }
    let index = 0
    const manifest: Array<{ folder: string; source: string }> = []
    for (const root of roots) {
      if (!existsSync(root)) throw new Error("有工作区不可访问，请连接磁盘后重试")
      const folder = `workspaces/${++index}`; manifest.push({ folder, source: root })
      const walk = async (dir: string) => {
        for (const entry of await readdir(dir, { withFileTypes: true })) {
          if ([".git", "node_modules", ".cache", ".DS_Store"].includes(entry.name) || entry.isSymbolicLink()) continue
          const path = join(dir, entry.name)
          if (entry.isDirectory()) await walk(path)
          else if (entry.isFile()) await add(path, `${folder}/${relative(root, path).replaceAll("\\", "/")}`)
        }
      }
      await walk(root)
    }
    const rendererState = activeHost && !activeHost.isDestroyed?.() && activeHost.executeJavaScript ? await activeHost.executeJavaScript(`Object.fromEntries(["app_current_workspace","resource_current_project","vessel-transit-v1","vessel-sidebar-width","vessel-transit-width"].map(key => [key, localStorage.getItem(key)]))`) : {}
    return new Uint8Array(gzipSync(JSON.stringify({ rendererState, format: "vessel-backup-v1", time: new Date().toISOString(), settings: { ...state.settings, backup: undefined }, workspaces: manifest, files: entries })))
  } finally { await rm(directory, { recursive: true, force: true }) }
}
async function backup() {
  const state = load()
  if (state.status.running) return state.status
  state.status = { ...state.status, running: true, error: undefined }
  try {
    const secret = decrypt(); const config = state.settings.backup
    if (!secret || !config.endpoint || !config.bucket || !config.accessKey) throw new Error("请先保存完整的 S3 配置")
    const bytes = await snapshot()
    const time = new Date().toISOString()
    await requestS3(config, secret, "PUT", `${config.prefix.replace(/\/+$/, "")}/vessel-${time.replace(/[:.]/g, "-")}.json.gz`, bytes)
    await persist({ ...load(), status: { time, size: bytes.byteLength, running: false } })
  } catch (error) {
    await persist({ ...load(), status: { ...load().status, running: false, error: error instanceof Error ? error.message : "备份失败" } })
    throw error
  }
  return load().status
}
function schedule() { clearInterval(timer); if (load().settings.backup.automatic) timer = setInterval(() => { void backup().catch(() => {}) }, load().settings.backup.minutes * 60000) }
export function registerSettings(host: WebContents) {
  activeHost = host
  load(); schedule()
  host.once?.("destroyed", () => { if (activeHost === host) { clearInterval(timer); activeHost = undefined } })
  app.once("will-quit", () => clearInterval(timer))
  host.ipc.handle("settings:get", () => publicSettings())
  host.ipc.handle("settings:info", () => ({ version: app.getVersion(), electron: process.versions.electron, node: process.versions.node }))
  host.ipc.handle("settings:save", async (_event, input: AppSettings, secret?: string) => {
    if (load().status.running) throw new Error("正在备份，请完成后再修改设置")
    const settings = validate(input)
    let encrypted = load().secret
    if (secret !== undefined) {
      if (typeof secret !== "string" || secret.length > 4096) throw new Error("Secret Key 格式无效")
      if (secret && !safeStorage.isEncryptionAvailable()) throw new Error("系统密钥存储不可用，无法安全保存 Secret Key")
      encrypted = secret ? safeStorage.encryptString(secret).toString("base64") : ""
    }
    if (settings.backup.automatic && (!encrypted || !settings.backup.endpoint || !settings.backup.bucket || !settings.backup.accessKey)) throw new Error("启用自动备份前请填写完整 S3 配置")
    await persist({ ...load(), settings, secret: encrypted }); schedule(); return publicSettings()
  })
  host.ipc.handle("settings:test", (_event, config: AppSettings["backup"], secret?: string) => requestS3(validate({ ...load().settings, backup: config }).backup, secret || decrypt(), "HEAD"))
  host.ipc.handle("settings:backup", backup)
  host.ipc.handle("settings:status", () => load().status)
}
