export interface DirectoryTreeDimensions {
  sidebarWidth: number
  rowHeight: number
  fontSize: number
  indent: number
  gap: number
}
export interface DirectoryTreeSettings {
  layoutEnabled: boolean
  layoutWorkspace: boolean
  layoutResources: boolean
  guidesEnabled: boolean
  guidesWorkspace: boolean
  guidesResources: boolean
  gapEnabled: boolean
  gapWorkspace: boolean
  gapResources: boolean
  folderBoldWorkspace: boolean
  folderBoldResources: boolean
  workspace: DirectoryTreeDimensions
  resources: DirectoryTreeDimensions
}

export interface AppSettings {
  directoryTree?: DirectoryTreeSettings
  fileTypeBadgesEnabled?: boolean
  fileTypeBadgesWorkspace?: boolean
  fileTypeBadgesResources?: boolean
  gitDecorationsEnabled?: boolean
  fileIconTheme?: "default" | "catppuccin" | "symbols" | "material"
  fileIconWorkspace?: boolean
  fileIconResources?: boolean
  catppuccinFlavor?: "auto" | "latte" | "frappe" | "macchiato" | "mocha"
  searchEngine?: "bing" | "google" | "baidu" | "duckduckgo"
  proxyEnabled?: boolean
  browserGroupSameDomain?: boolean
  resourceTreeStickyScroll?: boolean
  browserDevtoolsFollowWindow?: boolean
  externalScreenshot?: boolean
  externalPreview?: boolean
  attachmentLibraryEnabled?: boolean
  attachmentFolders?: string[]
  floatingVideoEnabled?: boolean
  monitorNavigation?: boolean
  navigationDelayMs?: number
  globalSearchEnabled?: boolean
  ignoredFiles?: string
  name: string
  email: string
  avatar: string
  theme: "light" | "dark" | "system"
  font: string
  fontSize: number
  accent: string
  editorFont?: string
  editorFontSize?: number
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
  chooseAvatar(): Promise<string | null>
  getBackupExportSecret(workspacePath?: string): Promise<string>
  saveSettings(settings: AppSettings, secret?: string): Promise<AppSettings>
  getSettingsInfo(): Promise<{ version: string; electron: string; node: string; deviceName: string }>
  testBackup(settings: AppSettings["backup"], secret?: string): Promise<void>
  setBackupWorkspace(path: string | null): Promise<void>
  runBackup(file?: string, workspace?: string): Promise<BackupStatus>
  previewBackup(): Promise<BackupStatus>
  getBackupStatus(): Promise<BackupStatus>
  getBackupLogs(): Promise<BackupLogs>
  clearBackupLogs(): Promise<void>
}
