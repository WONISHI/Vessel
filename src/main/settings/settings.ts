import { excludedBackupName, syncBackup } from "@main/sync/settings-backup"
import { createS3Storage } from "@main/sync/settings-s3"
import { getSyncDiagnostics } from "@main/sync/sync-diagnostics"
import { collectFiles, createSyncExcludeFilter, parseSyncExcludeRules, DEFAULT_CONFLICT_STRATEGY, type SyncProgress } from "@vessel/sync"
import type { AppSettings, BackupStatus } from "@vessel/type"
import { defaultSettings, isIgnoredEntry, isLegacyDefaultIgnoredFiles, parseIgnoredPatterns } from "@vessel/utils"
import { app, safeStorage, type WebContents } from "electron"
import { createHash } from "node:crypto"
import { EventEmitter } from "node:events"
import { existsSync, readFileSync, watch, type FSWatcher } from "node:fs"
import { lstat, mkdir, rename, writeFile } from "node:fs/promises"
import { isAbsolute, join } from "node:path"
export const settingsEvents = new EventEmitter()
type Profile = { config: AppSettings["backup"]; secret: string; status: BackupStatus }
let stored: { syncExcludeDefaultsVersion: number; settings: AppSettings; secret: string; status: BackupStatus; profiles: Record<string, Profile> } | undefined
let currentWorkspace: string | null = null

/** Returns current workspace. */
export function getCurrentWorkspace(): string | null {
  return currentWorkspace
}
let syncing = false

/** Performs the empty profile operation. */
const emptyProfile = (): Profile => ({ config: structuredClone(defaultSettings.backup), secret: "", status: { running: false } })

/** Performs the profile operation. */
const profile = (root = currentWorkspace): Profile => (root ? (load().profiles[root] ?? emptyProfile()) : emptyProfile())
let timer: ReturnType<typeof setInterval> | undefined
let watcher: FSWatcher | undefined
let saveTimer: ReturnType<typeof setTimeout> | undefined
let pendingSaveRoot: string | undefined
let activeHost: WebContents | undefined
let lastAttemptTime = 0

/** Performs the notify status operation. */
function notifyStatus(status: BackupStatus) {
  if (activeHost && (typeof activeHost.isDestroyed !== "function" || !activeHost.isDestroyed())) {
    try {
      activeHost.send?.("settings:status-changed", status)
    } catch {}
  }
}

/** Performs the file operation. */
const file = () => join(app.getPath("userData"), "settings.json")

const LEGACY_SYNC_EXCLUDE_RULES = new Set(["", "{folder:.vessel,node-modules,.git,.obsidian}"])

/** Loads load. */
function load() {
  if (!stored) {
    stored = { syncExcludeDefaultsVersion: 2, settings: structuredClone(defaultSettings), secret: "", status: { running: false }, profiles: {} }
    if (existsSync(file())) {
      const parsed = JSON.parse(readFileSync(file(), "utf8"))
      stored = {
        syncExcludeDefaultsVersion: 2,
        settings: validate(parsed.settings),
        secret: typeof parsed.secret === "string" ? parsed.secret : "",
        status: { running: false },
        profiles: Object.fromEntries(
          Object.entries(parsed.profiles || {}).map(([root, value]) => {
            const p = value as Profile
            return [
              root,
              {
                ...p,
                config: {
                  ...defaultSettings.backup,
                  ...p.config,
                  syncExcludeRules:
                    (parsed.syncExcludeDefaultsVersion ?? 0) < 2 && LEGACY_SYNC_EXCLUDE_RULES.has(p.config.syncExcludeRules?.trim() ?? "")
                      ? defaultSettings.backup.syncExcludeRules
                      : (p.config.syncExcludeRules ?? defaultSettings.backup.syncExcludeRules)
                },
                status: { ...p.status, running: false }
              }
            ]
          })
        )
      }
    }
  }
  return stored!
}

/** Validates validate. */
function validate(value: AppSettings): AppSettings {
  if (!value || !value.backup) throw new Error("设置格式无效")
  if (!["light", "dark", "system"].includes(value.theme) || ![5, 10, 30].includes(value.backup.minutes) || !Number.isInteger(value.fontSize) || value.fontSize < 12 || value.fontSize > 18) throw new Error("设置选项无效")
  if (!["Plus Jakarta Sans", "Inter", "system-ui", "PingFang SC", "Georgia"].includes(value.font) || !/^#[0-9a-f]{6}$/i.test(value.accent)) throw new Error("外观设置无效")
  const direction = value.backup.direction ?? "bidirectional",
    conflictStrategy = value.backup.conflictStrategy ?? DEFAULT_CONFLICT_STRATEGY
  const concurrency = value.backup.concurrency ?? 8,
    deleteThresholdPercent = value.backup.deleteThresholdPercent ?? 20,
    maxFileSizeMB = value.backup.maxFileSizeMB ?? 0
  if (
    !["push", "pull", "bidirectional"].includes(direction) ||
    !["keep-both", "keep-newer", "keep-larger", "error"].includes(conflictStrategy) ||
    !Number.isInteger(concurrency) ||
    concurrency < 1 ||
    concurrency > 32 ||
    !Number.isFinite(deleteThresholdPercent) ||
    deleteThresholdPercent < 0 ||
    deleteThresholdPercent > 100 ||
    !Number.isFinite(maxFileSizeMB) ||
    maxFileSizeMB < 0 ||
    maxFileSizeMB > 5120
  )
    throw new Error("同步选项无效")

  /** Performs the text operation. */
  const text = (v: string, max = 2048) => {
    if (typeof v !== "string" || v.length > max) throw new Error("设置文本过长或无效")
    return v.trim()
  }
  const syncExcludeRules = text(value.backup.syncExcludeRules ?? defaultSettings.backup.syncExcludeRules ?? "", 8192)
  parseSyncExcludeRules(syncExcludeRules)
  const avatar = text(value.avatar, 3_000_000)
  if (avatar && !/^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/.test(avatar)) throw new Error("头像格式无效")
  return {
    searchEngine: ["bing", "google", "baidu", "duckduckgo"].includes(value.searchEngine || "") ? value.searchEngine : "bing",
    proxyEnabled: value.proxyEnabled === true,
    externalScreenshot: value.externalScreenshot !== false,
    externalPreview: value.externalPreview !== false,
    monitorNavigation: value.monitorNavigation === true,
    globalSearchEnabled: value.globalSearchEnabled === true,
    ignoredFiles:
      typeof value.ignoredFiles === "string"
        ? isLegacyDefaultIgnoredFiles(value.ignoredFiles)
          ? defaultSettings.ignoredFiles!
          : text(value.ignoredFiles, 2048)
        : defaultSettings.ignoredFiles!,
    name: text(value.name, 80) || "本地用户",
    email: text(value.email, 254),
    avatar,
    theme: value.theme,
    font: value.font,
    fontSize: value.fontSize,
    accent: value.accent,
    backup: {
      syncExcludeRules,
      logEnabled: value.backup.logEnabled === true,
      direction,
      concurrency,
      conflictStrategy,
      deleteThresholdPercent,
      maxFileSizeMB,
      propagateDeletes: value.backup.propagateDeletes ?? defaultSettings.backup.propagateDeletes,
      syncOnSave: value.backup.syncOnSave === true,
      enabled: value.backup.enabled === true,
      endpoint: text(value.backup.endpoint),
      accessKey: text(value.backup.accessKey),
      bucket: text(value.backup.bucket),
      region: text(value.backup.region),
      prefix: text(value.backup.prefix),
      automatic: value.backup.automatic === true,
      minutes: value.backup.minutes,
      hasSecret: false
    }
  }
}

/** Performs the public settings operation. */
function publicSettings() {
  const p = profile()
  let secretLength = 0
  let secretUnavailable = false
  try {
    secretLength = p.secret ? decrypt(p).length : 0
  } catch {
    // Keep the ciphertext intact; ordinary settings do not require access to the backup credential.
    secretUnavailable = true
  }
  return { ...load().settings, backup: { ...p.config, workspacePath: currentWorkspace ?? undefined, hasSecret: !!p.secret, secretLength, secretUnavailable } }
}

/** Performs the decrypt operation. */
function decrypt(p = profile()): string {
  if (!p.secret) return ""
  try {
    return safeStorage.decryptString(Buffer.from(p.secret, "base64"))
  } catch {
    throw new Error("无法读取已保存的 Secret Key，请在同步与备份中重新输入；原始加密凭据已保留")
  }
}

/** Persists persist. */
async function persist(next: NonNullable<typeof stored>) {
  const path = file() + ".tmp"
  await writeFile(path, JSON.stringify(next), { mode: 0o600 })
  await rename(path, file())
  stored = next
}

/** Synchronizes directory. */
const syncDirectory = (root: string) => join(app.getPath("userData"), "sync-indexes", createHash("sha256").update(root).digest("hex"))

/** Performs the snapshot operation. */
async function snapshot(root: string, config: AppSettings["backup"], secret: string, selected?: string, onProgress?: (progress: SyncProgress) => void, dryRun = false) {
  const ignoredPatterns = parseIgnoredPatterns(load().settings.ignoredFiles)

  /** Performs the exclude operation. */
  const exclude = (name: string) => excludedBackupName(name) || isIgnoredEntry(name, ignoredPatterns)
  const excludePath = createSyncExcludeFilter(config.syncExcludeRules ?? defaultSettings.backup.syncExcludeRules ?? "")
  const directory = syncDirectory(root)
  await mkdir(directory, { recursive: true })
  const logger = config.logEnabled ? await getSyncDiagnostics(directory) : undefined

  /** Performs the safe operation. */
  const safe = (value: string) => [secret, config.accessKey, config.endpoint].filter(Boolean).reduce((result, sensitive) => result.split(sensitive).join("[已隐藏]"), value)
  let reportedError = false

  /** Performs the record operation. */
  const record = (entry: { type: string; message: string; path?: string; action?: string; code?: string }) => {
    if (entry.type === "error") reportedError = true
    logger?.record({ ...entry, message: safe(entry.message), path: entry.path ? safe(entry.path) : undefined })
  }
  record({ type: "start", message: `${dryRun ? "预览" : "同步"}扫描开始` })
  try {
    const entries = await collectFiles({ root, selected, exclude, excludePath, onExcluded: logger ? (path, kind) => record({ type: "excluded", path, message: `已排除${kind === "folder" ? "文件夹" : "文件"}` }) : undefined })
    return await syncBackup(directory, config, secret, entries, undefined, onProgress, { root, dryRun, paths: selected ? entries.map((file) => file.path) : undefined, exclude, excludePath, onLog: logger ? record : undefined })
  } catch (error) {
    if (!reportedError) record({ type: "error", message: error instanceof Error ? error.message : "同步失败" })
    throw error
  } finally {
    await logger?.flush()
  }
}

/** Backs up backup. */
async function backup(selected?: string, expectedRoot?: string, dryRun = false) {
  const root = currentWorkspace
  if (!root || (expectedRoot !== undefined && expectedRoot !== root)) throw new Error("当前页面不是可同步的工作区")
  if (selected !== undefined && (typeof selected !== "string" || !selected)) throw new Error("请先打开要同步的文件")
  const p = profile(root)
  if (!p.config.enabled) throw new Error("请先开启当前工作区同步")
  if (syncing) throw new Error("正在同步，请稍后重试")
  const secret = decrypt(p),
    config = p.config
  const previousStatus = p.status
  if (!secret || !config.endpoint || !config.bucket || !config.accessKey) throw new Error("请先保存完整的 S3 配置")
  syncing = true
  p.status = { ...p.status, running: true, error: undefined, progress: undefined }
  notifyStatus(p.status)
  try {
    const status = await snapshot(
      root,
      config,
      secret,
      selected,
      (progress) => {
        p.status = { ...p.status, progress }
        notifyStatus(p.status)
      },
      dryRun
    )
    if (dryRun) {
      p.status = previousStatus
      notifyStatus(p.status)
      return status
    }
    p.status = status
    await persist({ ...load(), profiles: { ...load().profiles, [root]: p } })
    notifyStatus(status)
    return status
  } catch (error) {
    if (dryRun) {
      p.status = previousStatus
      notifyStatus(p.status)
      throw error
    }
    p.status = { ...p.status, running: false, error: error instanceof Error ? error.message : "同步失败" }
    await persist({ ...load(), profiles: { ...load().profiles, [root]: p } })
    notifyStatus(p.status)
    throw error
  } finally {
    syncing = false
    if (pendingSaveRoot === currentWorkspace) {
      const pending = pendingSaveRoot
      pendingSaveRoot = undefined
      queueSaveSync(pending)
    }
  }
}

/** Performs the queue save sync operation. */
function queueSaveSync(root?: string) {
  if (!root || root !== currentWorkspace) return
  clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    if (root !== currentWorkspace || !profile(root).config.enabled || !profile(root).config.syncOnSave) return
    if (syncing) {
      pendingSaveRoot = root
      return
    }
    void backup(undefined, root).catch(() => {})
  }, 1500)
}

/** Checks auto sync. */
function checkAutoSync() {
  const root = currentWorkspace
  if (!root || syncing) return
  const p = profile(root)
  if (!p.config.enabled || !p.config.automatic) return
  let secret: string
  try {
    secret = decrypt(p)
  } catch {
    return
  }
  const config = p.config
  if (!secret || !config.endpoint || !config.bucket || !config.accessKey) return
  const lastSyncTime = p.status.time ? new Date(p.status.time).getTime() : 0
  const intervalMs = Math.max(1, p.config.minutes || 10) * 60000
  if (Date.now() - lastAttemptTime < 60000) return
  if (Date.now() - lastSyncTime >= intervalMs) {
    lastAttemptTime = Date.now()
    void backup(undefined, root).catch(() => {})
  }
}

/** Stops schedule. */
function stopSchedule() {
  clearInterval(timer)
  timer = undefined
  clearTimeout(saveTimer)
  watcher?.close()
  watcher = undefined
  pendingSaveRoot = undefined
}

/** Schedules schedule. */
function schedule() {
  stopSchedule()
  const p = profile(),
    root = currentWorkspace
  if (!root || !p.config.enabled) return
  if (p.config.automatic) {
    checkAutoSync()
    timer = setInterval(checkAutoSync, 15000)
  }
  if (p.config.syncOnSave) {
    const ignored = parseIgnoredPatterns(load().settings.ignoredFiles)
    const excludePath = createSyncExcludeFilter(p.config.syncExcludeRules ?? defaultSettings.backup.syncExcludeRules ?? "")
    try {
      watcher = watch(root, { recursive: true }, (_event, filename) => {
        if (!filename || filename.split(/[\\/]/).some((name) => excludedBackupName(name) || isIgnoredEntry(name, ignored))) return

        /** Performs the changed operation. */
        const changed = (kind?: "file" | "folder") => {
          if (kind ? excludePath(filename, kind) : excludePath(filename, "file") && excludePath(filename, "folder")) return
          if (syncing) pendingSaveRoot = root
          else queueSaveSync(root)
        }
        void lstat(join(root, filename))
          .then((info) => {
            if (!info.isSymbolicLink()) changed(info.isDirectory() ? "folder" : "file")
          })
          .catch(() => changed())
      })
      watcher.on("error", () => {
        watcher?.close()
        watcher = undefined
      })
    } catch {
      watcher = undefined
    }
  }
}

/** Registers settings. */
export function registerSettings(host: WebContents) {
  activeHost = host
  load()
  schedule()
  host.ipc.handle("settings:workspace", (_event, root: string | null) => {
    if (root !== null && (typeof root !== "string" || !isAbsolute(root))) throw new Error("工作区路径无效")
    if (currentWorkspace === root) return
    currentWorkspace = root
    schedule()
  })
  host.once?.("destroyed", () => {
    if (activeHost === host) {
      stopSchedule()
      activeHost = undefined
    }
  })
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
    await persist({ ...load(), settings: { ...settings, backup: settings.backup }, secret: encrypted, profiles: nextProfiles })
    settingsEvents.emit("changed")
    schedule()
    return publicSettings()
  })
  host.ipc.handle("settings:test", async (_event, config: AppSettings["backup"], secret?: string) => {
    const validated = validate({ ...load().settings, backup: config }).backup
    await createS3Storage(validated, secret || decrypt()).list!(validated.prefix.replace(/^\/+|\/+$/g, "") + (validated.prefix.replace(/^\/+|\/+$/g, "") ? "/" : ""))
  })
  host.ipc.handle("settings:backup", (_event, selected?: string, root?: string) => backup(selected, root))
  host.ipc.handle("settings:preview", () => backup(undefined, currentWorkspace ?? undefined, true))
  host.ipc.handle("settings:logs", async () => {
    if (!currentWorkspace) return { enabled: false, entries: [] }
    const logger = await getSyncDiagnostics(syncDirectory(currentWorkspace))
    return { enabled: profile().config.logEnabled === true, ...logger.get() }
  })
  host.ipc.handle("settings:logs:clear", async () => {
    if (!currentWorkspace) throw new Error("请先打开工作区")
    if (syncing) throw new Error("同步进行中，请完成后再清空日志")
    await (await getSyncDiagnostics(syncDirectory(currentWorkspace))).clear()
  })
  host.ipc.handle("settings:status", () => profile().status)
}

/** Checks whether monitor navigation. */
export const shouldMonitorNavigation = () => load().settings.monitorNavigation === true

/** Performs the general settings operation. */
export const generalSettings = () => load().settings

export { isIgnoredEntry, parseIgnoredPatterns } from "@vessel/utils"
