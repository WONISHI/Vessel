export type AppUpdateState =
  | { status: "unsupported" | "idle" | "checking" | "current" }
  | { status: "available" | "ready" | "installing"; version: string }
  | { status: "downloading"; version: string; percent: number }
  | { status: "error"; message: string }

export interface AppUpdateAPI {
  getAppUpdate(): Promise<AppUpdateState>
  checkAppUpdate(): Promise<void>
  downloadAppUpdate(): Promise<void>
  installAppUpdate(): Promise<void>
  onAppUpdate(callback: (state: AppUpdateState) => void): () => void
}
