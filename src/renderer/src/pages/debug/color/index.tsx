import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Slider } from "@/components/ui/slider"
import { copy } from "@/pages/debug/components/utility-tools-shared"
import { Copy, Palette } from "lucide-react"
import { useState } from "react"

/** Renders the color tool component. */
export function ColorTool() {
  const [rgba, setRgba] = useState([22, 163, 74, 100]),
    [draft, setDraft] = useState(""),
    [rgbaDraft, setRgbaDraft] = useState(""),
    [error, setError] = useState("")
  const [r, g, b, a] = rgba,
    hex =
      "#" +
      rgba
        .slice(0, 3)
        .map((v) => v.toString(16).padStart(2, "0"))
        .join("")
        .toUpperCase()
  const max = Math.max(r, g, b) / 255,
    min = Math.min(r, g, b) / 255,
    delta = max - min,
    light = (max + min) / 2
  const hue = delta === 0 ? 0 : ((max === r / 255 ? (g - b) / 255 / delta : max === g / 255 ? (b - r) / 255 / delta + 2 : (r - g) / 255 / delta + 4) * 60 + 360) % 360
  const hsl = `hsl(${Math.round(hue)}, ${Math.round(delta === 0 ? 0 : (delta / (1 - Math.abs(2 * light - 1))) * 100)}%, ${Math.round(light * 100)}%)`

  /** Performs the change hex operation. */
  const changeHex = (value: string) => {
    if (!/^#[a-f\d]{6}$/i.test(value)) {
      setError("请输入 6 位 HEX 颜色，例如 #16A34A")
      return
    }
    setRgba([parseInt(value.slice(1, 3), 16), parseInt(value.slice(3, 5), 16), parseInt(value.slice(5, 7), 16), a])
    setDraft("")
    setError("")
  }

  /** Performs the change rgba operation. */
  const changeRgba = (value: string) => {
    const match = value.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*(0?\.\d+|[01](?:\.0+)?))?\s*\)$/i)
    if (!match || match.slice(1, 4).some((v) => Number(v) > 255)) {
      setError("请输入有效 RGB 或 RGBA，例如 rgba(22, 163, 74, 1)")
      return
    }
    setRgba([Number(match[1]), Number(match[2]), Number(match[3]), Math.round(Number(match[4] ?? 1) * 100)])
    setRgbaDraft("")
    setDraft("")
    setError("")
  }
  return (
    <div className="flex h-full flex-col">
      <header className="tool-page-header">
        <span className="tool-page-brand">
          <Palette size={16} />
        </span>
        <div className="tool-page-heading">
          <h2>颜色转换</h2>
          <p>HEX、RGB、RGBA 与 HSL</p>
        </div>
      </header>
      <ScrollArea className="min-h-0 flex-1">
        <div className="color-controls grid grid-cols-2 gap-8 p-6">
          <section className="space-y-5">
            <div className="color-preview h-40 rounded-lg border">
              <div
                className="absolute inset-0"
                style={{ background: `rgba(${r},${g},${b},${a / 100})` }}
              />
            </div>
            <label className="block space-y-2 text-xs text-stone-500">
              HEX
              <div className="flex gap-2">
                <Input
                  aria-label="HEX"
                  value={draft || hex}
                  onChange={(e) => setDraft(e.target.value)}
                  onBlur={() => {
                    if (draft) changeHex(draft)
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") changeHex(draft || hex)
                  }}
                  className="font-mono text-xs"
                />
                <Button
                  variant="outline"
                  size="icon"
                  aria-label="复制 HEX"
                  onClick={() => copy(hex)}
                >
                  <Copy size={14} />
                </Button>
              </div>
            </label>
            <label className="block space-y-2 text-xs text-stone-500">
              RGBA
              <div className="flex gap-2">
                <Input
                  aria-label="RGBA"
                  value={rgbaDraft || `rgba(${r}, ${g}, ${b}, ${a / 100})`}
                  onChange={(e) => setRgbaDraft(e.target.value)}
                  onBlur={() => {
                    if (rgbaDraft) changeRgba(rgbaDraft)
                  }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") changeRgba(rgbaDraft || `rgba(${r}, ${g}, ${b}, ${a / 100})`)
                  }}
                  className="font-mono text-xs"
                />
                <Button
                  variant="outline"
                  size="icon"
                  aria-label="复制 RGBA"
                  onClick={() => copy(`rgba(${r}, ${g}, ${b}, ${a / 100})`)}
                >
                  <Copy size={14} />
                </Button>
              </div>
            </label>
            {error && (
              <p
                role="alert"
                className="text-xs text-red-600"
              >
                {error}
              </p>
            )}
            <p className="text-xs text-stone-500">预设</p>
            <div className="flex flex-wrap gap-2">
              {["#16A34A", "#2563EB", "#7C3AED", "#DC2626", "#D97706", "#0D9488", "#1C1917", "#78716C"].map((color) => (
                <Button
                  key={color}
                  size="icon"
                  aria-label={`颜色 ${color}`}
                  className="size-7 rounded-full border"
                  style={{ background: color }}
                  onClick={() => changeHex(color)}
                />
              ))}
            </div>
          </section>
          <section className="space-y-6">
            <h3 className="text-xs text-stone-500">RGBA 滑块</h3>
            {["R", "G", "B", "A"].map((label, index) => (
              <div
                className="flex items-center gap-3 text-xs"
                key={label}
              >
                <span className="w-3">{label}</span>
                <Slider
                  aria-label={label}
                  value={[rgba[index]]}
                  min={0}
                  max={index === 3 ? 100 : 255}
                  step={1}
                  onValueChange={(values) => {
                    setRgba(rgba.map((v, i) => (i === index ? values[0] : v)))
                    setDraft("")
                  }}
                />
                <span className="w-8 text-right font-mono">{index === 3 ? a / 100 : rgba[index]}</span>
              </div>
            ))}
            {[`rgb(${r}, ${g}, ${b})`, hsl].map((value) => (
              <div
                className="flex gap-2"
                key={value}
              >
                <Input
                  readOnly
                  value={value}
                  className="font-mono text-xs"
                />
                <Button
                  variant="outline"
                  size="icon"
                  aria-label={`复制 ${value}`}
                  onClick={() => copy(value)}
                >
                  <Copy size={14} />
                </Button>
              </div>
            ))}
          </section>
        </div>
      </ScrollArea>
    </div>
  )
}
