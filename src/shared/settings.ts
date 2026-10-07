export interface AppSettings {
  name: string
  email: string
  avatar: string
  theme: "light" | "dark" | "system"
  font: string
  fontSize: number
  accent: string
  backup: { endpoint: string; accessKey: string; bucket: string; region: string; prefix: string; automatic: boolean; minutes: 5 | 10 | 30; hasSecret: boolean; secretLength?: number }
}
export const defaultSettings: AppSettings = {
  name: "本地用户", email: "", avatar: "", theme: "light", font: "Plus Jakarta Sans", fontSize: 14, accent: "#16a34a",
  backup: { endpoint: "", accessKey: "", bucket: "", region: "us-east-1", prefix: "backups/", automatic: false, minutes: 10, hasSecret: false }
}
export interface BackupStatus { time?: string; size?: number; error?: string; running: boolean }
export interface SettingsAPI {
  getSettings(): Promise<AppSettings>
  saveSettings(settings: AppSettings, secret?: string): Promise<AppSettings>
  getSettingsInfo(): Promise<{ version: string; electron: string; node: string }>
  testBackup(settings: AppSettings["backup"], secret?: string): Promise<void>
  runBackup(): Promise<BackupStatus>
  getBackupStatus(): Promise<BackupStatus>
}
