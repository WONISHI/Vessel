export interface AppSettings {
  searchEngine?: "bing" | "google" | "baidu" | "duckduckgo"
  proxyEnabled?: boolean
  externalScreenshot?: boolean
  externalPreview?: boolean
  monitorNavigation?: boolean
  globalSearchEnabled?: boolean
  ignoredFiles?: string
  name: string
  email: string
  avatar: string
  theme: "light" | "dark" | "system"
  font: string
  fontSize: number
  accent: string
  backup: {
    syncExcludeRules?: string
    logEnabled?: boolean
    direction?: "push" | "pull" | "bidirectional"
    concurrency?: number
    conflictStrategy?: "keep-both" | "keep-newer" | "keep-larger" | "error"
    propagateDeletes?: boolean
    deleteThresholdPercent?: number
    maxFileSizeMB?: number
    syncOnSave?: boolean
    enabled?: boolean
    workspacePath?: string
    endpoint: string
    accessKey: string
    bucket: string
    region: string
    prefix: string
    automatic: boolean
    minutes: 5 | 10 | 30
    hasSecret: boolean
    secretLength?: number
    secretUnavailable?: boolean
  }
}

export interface BackupStatus {
  downloaded?: number
  downloadSize?: number
  durationMs?: number
  checked?: number
  hashed?: number
  cached?: number
  plan?: { path: string; action: string; reason: string }[]
  dryRun?: boolean
  skipped?: string[]
  progress?: {
    elapsedMs?: number
    active?: boolean
    phase?: "remote" | "hashing" | "planning" | "transferring"
    downloaded?: number
    completed: number
    total: number
    uploaded: number
    bytes: number
    conflicts: number
    path: string
  }
  changed?: number
  deleted?: number
  conflicts?: string[]
  time?: string
  size?: number
  error?: string
  running: boolean
}

export interface BackupLogEntry {
  id: string
  time: string
  type: string
  message: string
  path?: string
  action?: string
  code?: string
}

export interface BackupLogs {
  enabled: boolean
  entries: BackupLogEntry[]
  warning?: string
}

export interface SettingsAPI {
  getSettings(): Promise<AppSettings>
  saveSettings(settings: AppSettings, secret?: string): Promise<AppSettings>
  getSettingsInfo(): Promise<{ version: string; electron: string; node: string }>
  testBackup(settings: AppSettings["backup"], secret?: string): Promise<void>
  setBackupWorkspace(path: string | null): Promise<void>
  runBackup(file?: string, workspace?: string): Promise<BackupStatus>
  previewBackup(): Promise<BackupStatus>
  getBackupStatus(): Promise<BackupStatus>
  getBackupLogs(): Promise<BackupLogs>
  clearBackupLogs(): Promise<void>
}
