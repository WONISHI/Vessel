import { useEffect, useLayoutEffect, useRef } from "react"
import type { FileChange } from "../../../../../shared/file-watch"
const eventName = "vessel:files-changed"
const watches = new Map<string, { users: number; close: () => void }>()
export function useDirectoryWatch(root: string) {
  useEffect(() => {
    if (!window.electronAPI.watchStart) return
    let entry = watches.get(root)
    if (!entry) {
      let disposed = false
      let id: string | undefined
      const off = window.electronAPI.onFilesChanged((directory, changes, error) => {
        if (directory !== root) return
        if (error) console.error("文件监听失败", error)
        window.dispatchEvent(new CustomEvent(eventName, { detail: changes }))
      })
      entry = { users: 0, close: () => { disposed = true; off(); if (id) void window.electronAPI.watchStop(id).catch(() => {}) } }
      watches.set(root, entry)
      void window.electronAPI.watchStart(root).then(value => {
        if (disposed) void window.electronAPI.watchStop(value).catch(() => {})
        else id = value
      }).catch(error => console.error("无法监听目录", error))
    }
    entry.users++
    return () => { if (--entry.users === 0) { entry.close(); watches.delete(root) } }
  }, [root])
}
export function useFileChanges(callback: (changes: FileChange[]) => void) {
  const latest = useRef(callback)
  useLayoutEffect(() => { latest.current = callback }, [callback])
  useEffect(() => {
    const listener = (event: Event) => latest.current((event as CustomEvent<FileChange[]>).detail)
    window.addEventListener(eventName, listener)
    return () => window.removeEventListener(eventName, listener)
  }, [])
}
/** Keep programmatic reloads distinct from edits; reject reads superseded by local input. */
export function useExternalContent(path: string, content: string | undefined, apply: (content: string) => void) {
  const latest = useRef({ path, content, apply })
  useLayoutEffect(() => { latest.current = { path, content, apply } }, [path, content, apply])
  const request = useRef(0)
  useFileChanges(changes => {
    if (!changes.some(change => change.path === path && change.type !== "delete")) return
    const snapshot = latest.current
    const revision = ++request.current
    void window.electronAPI.readContent(path).then(value => {
      if (request.current === revision && latest.current.path === path && latest.current.content === snapshot.content && value !== latest.current.content) latest.current.apply(value)
    }).catch(() => {})
  })
  useEffect(() => () => { request.current++ }, [path])
}
