import "@/pages/settings/appearance.css"
import type { AppSettings } from "@vessel/type"

let themeTransitionActive = false
let latestAppearance: AppSettings | undefined

function commitAppearance(settings: AppSettings, dark: boolean) {
  const root = document.documentElement
  root.dataset.vesselAppearance = "true"
  root.classList.toggle("dark", dark)
  void window.electronAPI?.setWindowAppearance?.(dark)?.catch(() => {})
  root.style.fontSize = `${(16 * settings.fontSize) / 14}px`
  root.style.setProperty("--font-sans", `${settings.font}, system-ui, sans-serif`)
  document.body.style.fontFamily = `${settings.font}, system-ui, sans-serif`
  root.style.setProperty("--settings-accent", settings.accent)
  const hex = settings.accent.slice(1)
  const r = parseInt(hex.slice(0, 2), 16) / 255,
    g = parseInt(hex.slice(2, 4), 16) / 255,
    b = parseInt(hex.slice(4, 6), 16) / 255
  const max = Math.max(r, g, b),
    min = Math.min(r, g, b),
    d = max - min,
    l = (max + min) / 2
  const h = !d ? 0 : max === r ? ((g - b) / d + (g < b ? 6 : 0)) * 60 : max === g ? ((b - r) / d + 2) * 60 : ((r - g) / d + 4) * 60
  const s = !d ? 0 : d / (1 - Math.abs(2 * l - 1))
  root.style.setProperty("--accent-color", `${h} ${s * 100}% ${l * 100}%`)
}

/** Merge repeated settings notifications and finish each whole-page reveal before the next switch. */
export function applyAppearance(settings: AppSettings) {
  latestAppearance = settings
  if (themeTransitionActive) return
  const root = document.documentElement
  const dark = settings.theme === "dark" || (settings.theme === "system" && matchMedia("(prefers-color-scheme: dark)").matches)
  const themeChanged = root.classList.contains("dark") !== dark
  const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
  const update = () => commitAppearance(settings, dark)
  if (!root.dataset.vesselAppearance || !themeChanged || reducedMotion || !document.startViewTransition) {
    update()
    return
  }
  themeTransitionActive = true
  root.classList.add("vessel-theme-transition")
  const finish = () => {
    root.classList.remove("vessel-theme-transition")
    themeTransitionActive = false
    // The final notification may include updated sync metadata or another requested theme.
    if (latestAppearance && latestAppearance !== settings) applyAppearance(latestAppearance)
  }
  try {
    const transition = document.startViewTransition(async () => {
      update()
      // Let theme observers and embedded editors commit before capturing the new page.
      await new Promise<void>((resolve) => setTimeout(resolve, 32))
    })
    void transition.ready.catch(() => {})
    void transition.finished.catch(() => {}).finally(finish)
  } catch {
    update()
    finish()
  }
}
