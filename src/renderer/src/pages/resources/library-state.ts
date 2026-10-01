import { useMemo, useSyncExternalStore } from "react"
export type LibraryProject = { name: string; path: string }
type LibraryMeta = { count?: number; pins?: LibraryProject[]; lastPinned?: LibraryProject }
const key = "resource-library-meta"
const event = "vessel:library-meta"
const subscribe = (listener: () => void) => { window.addEventListener(event, listener); window.addEventListener("storage", listener); return () => { window.removeEventListener(event, listener); window.removeEventListener("storage", listener) } }
const snapshot = () => localStorage.getItem(key) || "{}"
export function readLibraryMeta(): LibraryMeta { try { return JSON.parse(snapshot()) } catch { return {} } }
export function updateLibraryMeta(patch: Partial<LibraryMeta>) { localStorage.setItem(key, JSON.stringify({ ...readLibraryMeta(), ...patch })); window.dispatchEvent(new Event(event)) }
export function useLibraryMeta() {
  const value = useSyncExternalStore(subscribe, snapshot)
  return useMemo(() => { try { return JSON.parse(value) as LibraryMeta } catch { return {} as LibraryMeta } }, [value])
}
export function selectLastPinned() {
  const project = readLibraryMeta().lastPinned
  if (!project) return false
  localStorage.setItem("resource_current_project", JSON.stringify({ ...project, files: [] }))
  window.dispatchEvent(new Event("vessel:resource-changed"))
  return true
}
