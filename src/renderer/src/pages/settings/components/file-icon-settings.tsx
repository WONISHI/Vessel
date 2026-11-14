import { useState } from "react"
import { ChevronDown, File, Folder, Palette } from "lucide-react"
import type { AppSettings } from "@vessel/type"
import { Switch } from "@/components/ui/switch"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { useDarkAppearance } from "@/hooks/use-dark-appearance"
import { fileIconNames, fileIconURL, resolveFileIcon } from "@/features/file-icons/resolve"
import { getFilePresentation } from "@/components/workspace/components/layout-aside/layout-workspace-sidebar/utils"
import { Row } from "./row"

type IconSettings = Pick<AppSettings, "fileIconTheme" | "fileIconWorkspace" | "fileIconResources" | "catppuccinFlavor">
const labels = { default: "默认（当前图标）", catppuccin: "Catppuccin Icons", symbols: "Symbols" }
const samples = ["src", "package.json", "index.ts", "App.vue", "README.md", "index.tsx", ".gitignore", "Dockerfile"]
export function FileIconSettings({ value, onChange }: { value: IconSettings; onChange: (patch: IconSettings) => void }) {
  const [open, setOpen] = useState(false), [query, setQuery] = useState("")
  const dark = useDarkAppearance(), theme = value.fileIconTheme ?? "default", flavor = value.catppuccinFlavor ?? "auto"
  const names = fileIconNames(theme)
  return <Collapsible open={open} onOpenChange={setOpen} className="settings-card">
    <CollapsibleTrigger className="settings-section-trigger flex w-full items-center gap-3 p-5 text-left transition-colors hover:bg-muted/40">
      <Palette className="size-5 shrink-0 text-green-600" /><div className="min-w-0 flex-1"><h3>文件图标</h3><p className="mt-1 text-xs text-muted-foreground">{labels[theme]} · {value.fileIconWorkspace ? "工作区" : ""}{value.fileIconWorkspace && value.fileIconResources !== false ? "、" : ""}{value.fileIconResources !== false ? "项目资源库" : ""}{!value.fileIconWorkspace && value.fileIconResources === false ? "未启用应用范围" : ""}</p></div><ChevronDown className={`size-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
    </CollapsibleTrigger>
    <CollapsibleContent className="border-t">
      <Row title="图标库" description="按文件名、类型和文件夹名称自动匹配">
        <Select value={theme} onValueChange={(next) => { if (next) onChange({ fileIconTheme: next as IconSettings["fileIconTheme"] }) }}><SelectTrigger aria-label="文件图标库" className="w-[200px]"><SelectValue /></SelectTrigger><SelectContent>{Object.entries(labels).map(([id, label]) => <SelectItem key={id} value={id}>{label}</SelectItem>)}</SelectContent></Select>
      </Row>
      {theme === "catppuccin" && <Row title="图标配色" description="自动模式随应用的明暗主题切换">
        <Select value={flavor} onValueChange={(next) => { if (next) onChange({ catppuccinFlavor: next as IconSettings["catppuccinFlavor"] }) }}><SelectTrigger aria-label="Catppuccin 配色" className="w-[200px]"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="auto">自动（跟随明暗主题）</SelectItem><SelectItem value="latte">Latte</SelectItem><SelectItem value="frappe">Frappé</SelectItem><SelectItem value="macchiato">Macchiato</SelectItem><SelectItem value="mocha">Mocha</SelectItem></SelectContent></Select>
      </Row>}
      <Row title="应用范围" description="关闭的区域继续使用默认图标">
        <div className="flex flex-wrap gap-4 text-xs"><label className="flex cursor-pointer items-center gap-2"><Switch checked={value.fileIconWorkspace === true} onCheckedChange={(checked) => onChange({ fileIconWorkspace: checked === true })} />工作区</label><label className="flex cursor-pointer items-center gap-2"><Switch checked={value.fileIconResources !== false} onCheckedChange={(checked) => onChange({ fileIconResources: checked === true })} />项目资源库</label></div>
      </Row>
      <div className="space-y-3 border-t p-5"><p className="text-xs font-medium">图标预览</p><div className="grid grid-cols-2 gap-3 sm:grid-cols-4">{samples.map((name) => {
        const directory = name === "src", icon = resolveFileIcon(theme, name, { directory, expanded: directory, dark }), src = icon && fileIconURL(theme, icon, flavor, dark)
        return <div key={name} className="flex min-w-0 items-center gap-2 text-xs">{src ? <img alt="" src={src} className="size-4 shrink-0" /> : directory ? <Folder className="size-4 shrink-0 text-amber-500" /> : <File className={`size-4 shrink-0 ${getFilePresentation(name).color}`} />}<span className="truncate">{name}</span></div>
      })}</div>
      {theme !== "default" && <details className="pt-2"><summary className="cursor-pointer text-xs text-muted-foreground">浏览完整图标库（{names.length} 个图标）</summary><Input aria-label="筛选图标" placeholder="搜索图标名称…" className="my-3" value={query} onChange={(event) => setQuery(event.target.value)} /><ScrollArea className="h-64"><div className="grid grid-cols-4 gap-3 pr-3 sm:grid-cols-6">{names.filter((name) => name.toLowerCase().includes(query.toLowerCase())).map((name) => <div key={name} title={name} className="flex min-w-0 flex-col items-center gap-1.5 rounded border p-2"><img alt="" loading="lazy" src={fileIconURL(theme, name, flavor, dark)} className="size-5" /><span className="w-full truncate text-center text-[9px] text-muted-foreground">{name}</span></div>)}</div></ScrollArea></details>}
      </div>
    </CollapsibleContent>
  </Collapsible>
}
