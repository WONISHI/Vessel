import { useSyncExternalStore } from "react"
import type { AppSettings } from "@vessel/type"

let current = { fontFamily: 'Menlo, Monaco, Consolas, "Courier New", monospace', fontSize: 14 }
const listeners = new Set<() => void>()
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener) } }
const snapshot = () => current

/** Interface typography never changes code typography. */
export function setEditorAppearance(settings: Pick<AppSettings, "editorFont" | "editorFontSize">) {
  const font = settings.editorFont ?? "Menlo"
  const fontFamily = font === "monospace" ? "monospace" : `"${font}", Menlo, Monaco, Consolas, "Courier New", monospace`
  const fontSize = settings.editorFontSize ?? 14
  if (current.fontFamily === fontFamily && current.fontSize === fontSize) return
  current = { fontFamily, fontSize }
  listeners.forEach(listener => listener())
}
export function useEditorAppearance() {
  return useSyncExternalStore(subscribe, snapshot, snapshot)
}
