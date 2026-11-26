import type { AppSettings } from "@vessel/type"
export const editorThemes: { value: NonNullable<AppSettings["editorTheme"]>; label: string }[] = [
  { value: "system", label: "跟随界面" },
  { value: "light", label: "VS Code 浅色" },
  { value: "vs-dark", label: "VS Code 深色" },
  { value: "vessel-github-light", label: "GitHub 浅色" },
  { value: "vessel-dark", label: "Vessel 深色" },
  { value: "vessel-nord-light", label: "Nord 浅色" },
  { value: "vessel-nord", label: "Nord 深色" },
  { value: "hc-black", label: "高对比度深色" }
]
export function resolveEditorTheme(theme: AppSettings["editorTheme"], dark: boolean) {
  return !theme || theme === "system" ? dark ? "vessel-dark" : "light" : theme
}
