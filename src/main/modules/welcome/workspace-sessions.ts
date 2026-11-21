import { app } from "electron"
import { join } from "node:path"
import { WorkspaceSessionStore } from "./workspace-session-store"

let store: WorkspaceSessionStore | undefined
export function workspaceSessions() {
  return store ??= new WorkspaceSessionStore(join(app.getPath("userData"), "state", "workspace-sessions.json"))
}
export function drainWorkspaceSessionWrites() {
  return store?.flush() ?? null
}
