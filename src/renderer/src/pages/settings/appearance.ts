import "./appearance.css"
import type { AppSettings } from "../../../../shared/settings"
export function applyAppearance(settings: AppSettings) {
  const root = document.documentElement
  const dark = settings.theme === "dark" || (settings.theme === "system" && matchMedia("(prefers-color-scheme: dark)").matches)
  root.dataset.vesselAppearance = "true"
  root.classList.toggle("dark", dark)
  root.style.fontSize = `${16 * settings.fontSize / 14}px`
  root.style.setProperty("--font-sans", `${settings.font}, system-ui, sans-serif`)
  document.body.style.fontFamily = `${settings.font}, system-ui, sans-serif`
  root.style.setProperty("--settings-accent", settings.accent)
  const hex = settings.accent.slice(1)
  const r = parseInt(hex.slice(0, 2), 16) / 255, g = parseInt(hex.slice(2, 4), 16) / 255, b = parseInt(hex.slice(4, 6), 16) / 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min, l = (max + min) / 2
  const h = !d ? 0 : max === r ? ((g - b) / d + (g < b ? 6 : 0)) * 60 : max === g ? ((b - r) / d + 2) * 60 : ((r - g) / d + 4) * 60
  const s = !d ? 0 : d / (1 - Math.abs(2 * l - 1))
  root.style.setProperty("--accent-color", `${h} ${s * 100}% ${l * 100}%`)
}
