import { useSyncExternalStore } from "react"
import type { AppSettings } from "@vessel/type"

let current: { theme: NonNullable<AppSettings["editorTheme"]>; fontFamily: string; fontSize: number } = { theme: "system", fontFamily: 'Menlo, Monaco, Consolas, "Courier New", monospace', fontSize: 14 }
const listeners = new Set<() => void>()
const subscribe = (listener: () => void) => { listeners.add(listener); return () => { listeners.delete(listener) } }
const snapshot = () => current

/** Interface typography never changes code typography. */
export function setEditorAppearance(settings: Pick<AppSettings, "editorFont" | "editorFontSize" | "editorTheme">) {
  const font = settings.editorFont ?? "Menlo"
  const fontFamily = font === "monospace" ? "monospace" : `"${font}", Menlo, Monaco, Consolas, "Courier New", monospace`
  const fontSize = settings.editorFontSize ?? 14
  const theme = settings.editorTheme ?? "system"
  if (current.fontFamily === fontFamily && current.fontSize === fontSize && current.theme === theme) return
  current = { fontFamily, fontSize, theme }
  listeners.forEach(listener => listener())
}
export function useEditorAppearance() {
  return useSyncExternalStore(subscribe, snapshot, snapshot)
}
