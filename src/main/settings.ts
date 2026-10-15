import { EventEmitter } from "node:events"
export const settingsEvents = new EventEmitter()
import { app, safeStorage, type WebContents } from "electron"
import { readFileSync, existsSync, watch, type FSWatcher } from "node:fs"
import { writeFile, rename, mkdir } from "node:fs/promises"
import { join, isAbsolute } from "node:path"
import { createHash } from "node:crypto"
import { syncBackup, excludedBackupName } from "./settings-backup"
import { defaultSettings, type AppSettings, type BackupStatus, parseIgnoredPatterns, isIgnoredEntry } from "../shared/settings"
import { collectFiles, type SyncProgress } from "@vessel/sync"
import { createS3Storage } from "./settings-s3"
type Profile = { config: AppSettings["backup"]; secret: string; status: BackupStatus }
let stored: { settings: AppSettings; secret: string; status: BackupStatus; profiles: Record<string, Profile> } | undefined
let currentWorkspace: string | null = null
let syncing = false
const emptyProfile = (): Profile => ({ config: structuredClone(defaultSettings.backup), secret: "", status: { running: false } })
const profile = (root = currentWorkspace): Profile => root ? (load().profiles[root] ?? emptyProfile()) : emptyProfile()
let timer: ReturnType<typeof setInterval> | undefined
let watcher: FSWatcher | undefined
let saveTimer: ReturnType<typeof setTimeout> | undefined
let pendingSaveRoot: string | undefined
let activeHost: WebContents | undefined
const file = () => join(app.getPath("userData"), "settings.json")
function load() {
  if (!stored) {
    stored = { settings: structuredClone(defaultSettings), secret: "", status: { running: false }, profiles: {} }
    if (existsSync(file())) {
      const parsed = JSON.parse(readFileSync(file(), "utf8"))
      stored = { settings: validate(parsed.settings), secret: typeof parsed.secret === "string" ? parsed.secret : "", status: { running: false }, profiles: Object.fromEntries(Object.entries(parsed.profiles || {}).map(([root, value]) => { const p = value as Profile; return [root, { ...p, status: { ...p.status, running: false } }] })) }
    }
  }
  return stored!
}
function validate(value: AppSettings): AppSettings {
  if (!value || !value.backup) throw new Error("设置格式无效")
  if (!["light", "dark", "system"].includes(value.theme) || ![5, 10, 30].includes(value.backup.minutes) || !Number.isInteger(value.fontSize) || value.fontSize < 12 || value.fontSize > 18) throw new Error("设置选项无效")
  if (!["Plus Jakarta Sans", "Inter", "system-ui", "PingFang SC", "Georgia"].includes(value.font) || !/^#[0-9a-f]{6}$/i.test(value.accent)) throw new Error("外观设置无效")
  const direction = value.backup.direction ?? "bidirectional", conflictStrategy = value.backup.conflictStrategy ?? "keep-both"
  const concurrency = value.backup.concurrency ?? 8, deleteThresholdPercent = value.backup.deleteThresholdPercent ?? 20, maxFileSizeMB = value.backup.maxFileSizeMB ?? 0
  if (!["push", "pull", "bidirectional"].includes(direction) || !["keep-both", "keep-newer", "keep-larger", "error"].includes(conflictStrategy) || !Number.isInteger(concurrency) || concurrency < 1 || concurrency > 32 || !Number.isFinite(deleteThresholdPercent) || deleteThresholdPercent < 0 || deleteThresholdPercent > 100 || !Number.isFinite(maxFileSizeMB) || maxFileSizeMB < 0 || maxFileSizeMB > 5120) throw new Error("同步选项无效")
  const text = (v: string, max = 2048) => { if (typeof v !== "string" || v.length > max) throw new Error("设置文本过长或无效"); return v.trim() }
  const avatar = text(value.avatar, 3_000_000)
  if (avatar && !/^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/.test(avatar)) throw new Error("头像格式无效")
  return { searchEngine: ["bing", "google", "baidu", "duckduckgo"].includes(value.searchEngine || "") ? value.searchEngine : "bing", proxyEnabled: value.proxyEnabled === true, externalScreenshot: value.externalScreenshot !== false, externalPreview: value.externalPreview !== false, monitorNavigation: value.monitorNavigation === true, globalSearchEnabled: value.globalSearchEnabled === true, ignoredFiles: typeof value.ignoredFiles === "string" ? text(value.ignoredFiles, 2048) : ".obsidian, .gut", name: text(value.name, 80) || "本地用户", email: text(value.email, 254), avatar, theme: value.theme, font: value.font, fontSize: value.fontSize, accent: value.accent, backup: { direction, concurrency, conflictStrategy, deleteThresholdPercent, maxFileSizeMB, propagateDeletes: value.backup.propagateDeletes === true, syncOnSave: value.backup.syncOnSave === true, enabled: value.backup.enabled === true, endpoint: text(value.backup.endpoint), accessKey: text(value.backup.accessKey), bucket: text(value.backup.bucket), region: text(value.backup.region), prefix: text(value.backup.prefix), automatic: value.backup.automatic === true, minutes: value.backup.minutes, hasSecret: false } }
}
function publicSettings() { const p = profile(); return { ...load().settings, backup: { ...p.config, workspacePath: currentWorkspace ?? undefined, hasSecret: !!p.secret, secretLength: p.secret ? decrypt(p).length : 0 } } }
const decrypt = (p = profile()) => p.secret ? safeStorage.decryptString(Buffer.from(p.secret, "base64")) : ""
async function persist(next: NonNullable<typeof stored>) { const path = file() + ".tmp"; await writeFile(path, JSON.stringify(next), { mode: 0o600 }); await rename(path, file()); stored = next }
async function snapshot(root: string, config: AppSettings["backup"], secret: string, selected?: string, onProgress?: (progress: SyncProgress) => void, dryRun = false) {
  const ignoredPatterns = parseIgnoredPatterns(load().settings.ignoredFiles)
  const entries = await collectFiles({ root, selected, exclude: name => excludedBackupName(name) || isIgnoredEntry(name, ignoredPatterns) })
  const directory = join(app.getPath("userData"), "sync-indexes", createHash("sha256").update(root).digest("hex"))
  await mkdir(directory, { recursive: true })
  return syncBackup(directory, config, secret, entries, undefined, onProgress, { root, dryRun, paths: selected ? entries.map(file => file.path) : undefined, exclude: name => excludedBackupName(name) || isIgnoredEntry(name, ignoredPatterns) })
}
async function backup(selected?: string, expectedRoot?: string, dryRun = false) {
  const root = currentWorkspace
  if (!root || (expectedRoot !== undefined && expectedRoot !== root)) throw new Error("当前页面不是可同步的工作区")
  if (selected !== undefined && (typeof selected !== "string" || !selected)) throw new Error("请先打开要同步的文件")
  const p = profile(root)
  if (!p.config.enabled) throw new Error("请先开启当前工作区同步")
  if (syncing) throw new Error("正在同步，请稍后重试")
  const secret = decrypt(p), config = p.config
  const previousStatus = p.status
  if (!secret || !config.endpoint || !config.bucket || !config.accessKey) throw new Error("请先保存完整的 S3 配置")
  syncing = true
  p.status = { ...p.status, running: true, error: undefined, progress: undefined }
  try {
    const status = await snapshot(root, config, secret, selected, progress => { p.status = { ...p.status, progress } }, dryRun)
    if (dryRun) { p.status = previousStatus; return status }
    p.status = status
    await persist({ ...load(), profiles: { ...load().profiles, [root]: p } })
    return status
  } catch (error) {
    if (dryRun) { p.status = previousStatus; throw error }
    p.status = { ...p.status, running: false, error: error instanceof Error ? error.message : "同步失败" }
    await persist({ ...load(), profiles: { ...load().profiles, [root]: p } })
    throw error
  } finally { syncing = false; if (pendingSaveRoot === currentWorkspace) { const pending = pendingSaveRoot; pendingSaveRoot = undefined; queueSaveSync(pending) } }
}
function queueSaveSync(root?: string) {
  if (!root || root !== currentWorkspace) return
  clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    if (root !== currentWorkspace || !profile(root).config.enabled || !profile(root).config.syncOnSave) return
    if (syncing) { pendingSaveRoot = root; return }
    void backup(undefined, root).catch(() => {})
  }, 1500)
}
function stopSchedule() { clearInterval(timer); clearTimeout(saveTimer); watcher?.close(); watcher = undefined; pendingSaveRoot = undefined }
function schedule() {
  stopSchedule()
  const p = profile(), root = currentWorkspace
  if (!root || !p.config.enabled) return
  if (p.config.automatic) timer = setInterval(() => { void backup(undefined, root).catch(() => {}) }, p.config.minutes * 60000)
  if (p.config.syncOnSave) {
    const ignored = parseIgnoredPatterns(load().settings.ignoredFiles)
    try {
      watcher = watch(root, { recursive: true }, (_event, filename) => {
        if (!filename || filename.split(/[\\/]/).some(name => excludedBackupName(name) || isIgnoredEntry(name, ignored))) return
        // Coalesce saves during a running pass into one follow-up; unchanged passes do not retrigger.
        if (syncing) pendingSaveRoot = root
        else queueSaveSync(root)
      })
      watcher.on("error", () => { watcher?.close(); watcher = undefined })
    } catch { watcher = undefined }
  }
}
export function registerSettings(host: WebContents) {
  activeHost = host
  load(); schedule()
  host.ipc.handle("settings:workspace", (_event, root: string | null) => {
    if (root !== null && (typeof root !== "string" || !isAbsolute(root))) throw new Error("工作区路径无效")
    currentWorkspace = root; schedule()
  })
  host.once?.("destroyed", () => { if (activeHost === host) { stopSchedule(); activeHost = undefined } })
  app.once("will-quit", stopSchedule)
  host.ipc.handle("settings:get", () => publicSettings())
  host.ipc.handle("settings:info", () => ({ version: app.getVersion(), electron: process.versions.electron, node: process.versions.node }))
  host.ipc.handle("settings:save", async (_event, input: AppSettings, secret?: string) => {
    if (syncing) throw new Error("正在备份，请完成后再修改设置")
    const settings = validate(input)
    if (input.backup.workspacePath !== (currentWorkspace ?? undefined)) throw new Error("工作区已切换，请重新打开设置")
    const root = currentWorkspace
    let encrypted = profile().secret
    if (secret !== undefined) {
      if (typeof secret !== "string" || secret.length > 4096) throw new Error("Secret Key 格式无效")
      if (secret && !safeStorage.isEncryptionAvailable()) throw new Error("系统密钥存储不可用，无法安全保存 Secret Key")
      encrypted = secret ? safeStorage.encryptString(secret).toString("base64") : ""
    }
    if (settings.backup.enabled && (!encrypted || !settings.backup.endpoint || !settings.backup.bucket || !settings.backup.accessKey)) throw new Error("启用自动备份前请填写完整 S3 配置")
    if (!root && settings.backup.enabled) throw new Error("请先打开工作区，项目资源库不支持同步")
    const nextProfiles = { ...load().profiles }
    if (root) nextProfiles[root] = { config: settings.backup, secret: encrypted, status: profile().status }
    await persist({ ...load(), settings: { ...settings, backup: settings.backup }, secret: encrypted, profiles: nextProfiles }); settingsEvents.emit("changed"); schedule(); return publicSettings()
  })
  host.ipc.handle("settings:test", async (_event, config: AppSettings["backup"], secret?: string) => { const validated = validate({ ...load().settings, backup: config }).backup; await createS3Storage(validated, secret || decrypt()).list!(validated.prefix.replace(/^\/+|\/+$/g, "") + (validated.prefix.replace(/^\/+|\/+$/g, "") ? "/" : "")) })
  host.ipc.handle("settings:backup", (_event, selected?: string, root?: string) => backup(selected, root))
  host.ipc.handle("settings:preview", () => backup(undefined, currentWorkspace ?? undefined, true))
  host.ipc.handle("settings:status", () => profile().status)
}

export const shouldMonitorNavigation = () => load().settings.monitorNavigation === true

export const generalSettings = () => load().settings

export { parseIgnoredPatterns, isIgnoredEntry } from "../shared/settings"
