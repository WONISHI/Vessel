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
  backup: { direction?: "push" | "pull" | "bidirectional"; concurrency?: number; conflictStrategy?: "keep-both" | "keep-newer" | "keep-larger" | "error"; propagateDeletes?: boolean; deleteThresholdPercent?: number; maxFileSizeMB?: number; syncOnSave?: boolean; enabled?: boolean; workspacePath?: string; endpoint: string; accessKey: string; bucket: string; region: string; prefix: string; automatic: boolean; minutes: 5 | 10 | 30; hasSecret: boolean; secretLength?: number }
}
export const defaultSettings: AppSettings = {
  searchEngine: "bing", proxyEnabled: false, externalScreenshot: true, externalPreview: true, monitorNavigation: false, globalSearchEnabled: false, ignoredFiles: ".obsidian, .gut", name: "本地用户", email: "", avatar: "", theme: "light", font: "Plus Jakarta Sans", fontSize: 14, accent: "#16a34a",
  backup: { direction: "bidirectional", concurrency: 8, conflictStrategy: "keep-both", propagateDeletes: false, deleteThresholdPercent: 20, maxFileSizeMB: 0, syncOnSave: false, enabled: false, endpoint: "", accessKey: "", bucket: "", region: "us-east-1", prefix: "backups/", automatic: false, minutes: 10, hasSecret: false }
}
export function parseIgnoredPatterns(patternStr?: string): string[] {
  if (typeof patternStr !== "string" || !patternStr.trim()) {
    return [".obsidian", ".gut"]
  }
  return patternStr
    .split(/[,，\n]+/)
    .map((s) => s.trim())
    .filter(Boolean)
}
export function isIgnoredEntry(name: string, patterns: string[]): boolean {
  if (!name || !patterns.length) return false
  const lowerName = name.toLowerCase()
  for (const pattern of patterns) {
    const lowerPattern = pattern.toLowerCase()
    if (lowerName === lowerPattern) return true
    if (lowerPattern.startsWith("*") && lowerPattern.endsWith("*") && lowerPattern.length > 2) {
      if (lowerName.includes(lowerPattern.slice(1, -1))) return true
    } else if (lowerPattern.startsWith("*")) {
      if (lowerName.endsWith(lowerPattern.slice(1))) return true
    } else if (lowerPattern.endsWith("*")) {
      if (lowerName.startsWith(lowerPattern.slice(0, -1))) return true
    }
  }
  return false
}
export interface BackupStatus { downloaded?: number; downloadSize?: number; durationMs?: number; checked?: number; hashed?: number; cached?: number; plan?: { path: string; action: string; reason: string }[]; dryRun?: boolean; skipped?: string[]; progress?: { elapsedMs?: number; active?: boolean; phase?: "remote" | "hashing" | "planning" | "transferring"; downloaded?: number; completed: number; total: number; uploaded: number; bytes: number; conflicts: number; path: string }; changed?: number; deleted?: number; conflicts?: string[]; time?: string; size?: number; error?: string; running: boolean }
export interface SettingsAPI {
  getSettings(): Promise<AppSettings>
  saveSettings(settings: AppSettings, secret?: string): Promise<AppSettings>
  getSettingsInfo(): Promise<{ version: string; electron: string; node: string }>
  testBackup(settings: AppSettings["backup"], secret?: string): Promise<void>
  setBackupWorkspace(path: string | null): Promise<void>
  runBackup(file?: string, workspace?: string): Promise<BackupStatus>
  previewBackup(): Promise<BackupStatus>
  getBackupStatus(): Promise<BackupStatus>
}
