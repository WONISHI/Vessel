import { ACTIVITY_ITEMS } from "./activity-bar/constants"
import { Activity, CalendarDays, Binary, Braces, CaseSensitive, Database, GitBranch, House, Languages, Layers, Link, Monitor, Palette, Send, Settings, Wrench } from "lucide-react"

const tools = {
  json: { label: "JSON 格式化", icon: Braces },
  color: { label: "颜色转换", icon: Palette },
  "case-convert": { label: "转写工具", icon: CaseSensitive },
  base64: { label: "Base64", icon: Binary },
  url: { label: "URL 编解码", icon: Link },
  translate: { label: "翻译", icon: Languages },
  performance: { label: "性能监控", icon: Activity },
  system: { label: "系统信息", icon: Monitor },
  storage: { label: "数据存储", icon: Database }
}
const pages = {
  todos: { label: "待办", icon: CalendarDays },
  git: { label: "Git", icon: GitBranch },
  "api-client": { label: "API", icon: Send },
  settings: { label: "设置", icon: Settings },
  welcome: { label: "首页", icon: House },
  devtools: { label: "开发者工具", icon: Wrench },
  debug: { label: "调试工具", icon: Wrench }
}

/** Titlebar identity follows the active feature, including developer-tool subpages. */
export function titlebarPage(pathname: string) {
  const [section = "welcome", child] = pathname.split("/").filter(Boolean)
  if ((section === "devtools" || section === "debug") && child && child in tools) return tools[child as keyof typeof tools]
  const activity = ACTIVITY_ITEMS.find((item) => item.id === (section === "editor" ? "files" : section))
  return activity ?? pages[section as keyof typeof pages] ?? { label: "Vessel", icon: Layers }
}
