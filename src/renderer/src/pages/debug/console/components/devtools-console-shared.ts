export type LogLevel = "log" | "info" | "warn" | "error"
export interface LogEntry {
  id: number
  time: string
  level: LogLevel
  message: string
}
export const INITIAL_LOGS: LogEntry[] = [
  { id: 1, time: "[14:32:05]", level: "log", message: "App initialized successfully" },
  { id: 2, time: "[14:32:06]", level: "info", message: "Workspace loaded: /Users/dev/Documents/notes" },
  { id: 3, time: "[14:32:08]", level: "log", message: "Rendered 42 files in workspace" },
  { id: 4, time: "[14:32:15]", level: "warn", message: "Deprecated API used: oldFormat() will be removed in v2.0" },
  { id: 5, time: "[14:32:20]", level: "log", message: '{"user": "alice", "action": "save", "file": "note.md"}' },
  {
    id: 6,
    time: "[14:32:25]",
    level: "error",
    message: "TypeError: Cannot read properties of undefined (reading 'map') at Editor.render (editor.tsx:142) at ReactComponent.render (react-dom.js:1234)"
  }
]
export const levelStyle: Record<LogLevel, string> = {
  log: "text-stone-700",
  info: "text-teal-700",
  warn: "rounded-md bg-amber-50 text-amber-700",
  error: "rounded-md bg-red-50 text-red-700"
}
