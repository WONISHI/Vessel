import { Keyboard, Palette, RefreshCw, Settings, UserRound } from "lucide-react"
export const sections = [
  { id: "about", label: "关于", icon: UserRound },
  { id: "appearance", label: "外观", icon: Palette },
  { id: "shortcuts", label: "快捷键", icon: Keyboard },
  { id: "sync", label: "同步与备份", icon: RefreshCw },
  { id: "general", label: "通用配置", icon: Settings }
] as const
export const fonts = ["Plus Jakarta Sans", "Inter", "system-ui", "PingFang SC", "Georgia"]
