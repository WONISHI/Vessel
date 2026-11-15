import { useSyncExternalStore } from "react"

export type GitDecorationCode = "M" | "A" | "U" | "D" | "C" | "R"
type Store = { files: Map<string, GitDecorationCode>; folders: Map<string, GitDecorationCode> }
const stores = new Map<string, Store>()
const pending = new Map<string, Promise<void>>()
const listeners = new Set<() => void>()
let version = 0
const norm = (path: string) => path.replace(/\\/g, "/").replace(/\/$/, "")
const rank: Record<GitDecorationCode, number> = { C: 5, D: 4, M: 3, R: 2, A: 1, U: 0 }

/** Reads `git status` once for a workspace; callers refresh only when Git history or the index may have changed. */
export function refreshGitDecorations(root: string) {
  const key = norm(root)
  const running = pending.get(key)
  if (running) return running
  const task = window.electronAPI.getGitDecorations(root).then((result) => {
    const files = new Map<string, GitDecorationCode>(), folders = new Map<string, GitDecorationCode>()
    for (const entry of result?.entries ?? []) {
      files.set(entry.path, entry.code)
      // Like VS Code, deleted files are not propagated to parent folders.
      if (entry.code === "D") continue
      // Include the entry itself (an untracked directory is reported as one entry) and every ancestor up to the root.
      for (let parent = entry.path; parent.length >= key.length; parent = parent.slice(0, Math.max(0, parent.lastIndexOf("/")))) {
        const current = folders.get(parent)
        if (!current || rank[entry.code] > rank[current]) folders.set(parent, entry.code)
        if (parent.length === key.length) break
      }
    }
    const previous = stores.get(key)
    const same = previous && previous.files.size === files.size && [...files].every(([path, code]) => previous.files.get(path) === code)
    if (!same) {
      stores.set(key, { files, folders })
      version++
      listeners.forEach((listener) => listener())
    }
  }).catch(() => {}).finally(() => { pending.delete(key) })
  pending.set(key, task)
  return task
}

const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener) } }
const snapshot = () => version

/** Status of a file, or the strongest status among a folder's changed descendants. */
export function useGitDecoration(root: string | undefined, path: string, folder: boolean): GitDecorationCode | undefined {
  useSyncExternalStore(subscribe, snapshot, snapshot)
  if (!root) return undefined
  const store = stores.get(norm(root))
  return (folder ? store?.folders : store?.files)?.get(norm(path))
}

export const gitDecorationStyle: Record<GitDecorationCode, { label: string; title: string; text: string }> = {
  M: { label: "M", title: "已修改", text: "text-[#895503] dark:text-[#e2c08d]" },
  A: { label: "A", title: "已暂存的新文件", text: "text-[#587c0c] dark:text-[#81b88b]" },
  U: { label: "U", title: "未跟踪", text: "text-[#007100] dark:text-[#73c991]" },
  R: { label: "R", title: "已重命名", text: "text-[#007100] dark:text-[#73c991]" },
  D: { label: "D", title: "已删除", text: "text-[#ad0707] dark:text-[#c74e39]" },
  C: { label: "C", title: "存在冲突", text: "text-[#ad0707] dark:text-[#e4676b]" }
}
