import { useState } from "react"
import { ChevronDown, Tags } from "lucide-react"
import type { AppSettings } from "@vessel/type"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Switch } from "@/components/ui/switch"
import { Row } from "./row"

type BadgeSettings = Pick<AppSettings, "fileTypeBadgesEnabled" | "fileTypeBadgesWorkspace" | "fileTypeBadgesResources">
export function FileTypeBadgeSettings({ value, onChange }: { value: BadgeSettings; onChange: (patch: BadgeSettings) => void }) {
  const [open, setOpen] = useState(false)
  const enabled = value.fileTypeBadgesEnabled === true
  const workspace = value.fileTypeBadgesWorkspace === true, resources = value.fileTypeBadgesResources !== false
  return <Collapsible open={open} onOpenChange={setOpen} className="settings-card">
    <CollapsibleTrigger className="settings-section-trigger flex w-full items-center gap-3 p-5 text-left transition-colors hover:bg-muted/40">
      <Tags className="size-5 shrink-0 text-green-600" /><div className="min-w-0 flex-1"><h3>文件类型徽标</h3><p className="mt-1 text-xs text-muted-foreground">{enabled ? "已开启" : "已关闭"} · {workspace && "工作区"}{workspace && resources && "、"}{resources && "项目资源库"}{!workspace && !resources && "未启用应用范围"}</p></div><ChevronDown className={`size-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
    </CollapsibleTrigger>
    <CollapsibleContent className="border-t">
      <Row title="显示文件类型徽标" description="在文件树右侧显示 MD、XLSX 等文件类型标记"><Switch aria-label="显示文件类型徽标" checked={enabled} onCheckedChange={(checked) => onChange({ fileTypeBadgesEnabled: checked })} /></Row>
      <Row title="作用于工作区"><Switch aria-label="文件类型徽标作用于工作区" checked={workspace} onCheckedChange={(checked) => onChange({ fileTypeBadgesWorkspace: checked })} /></Row>
      <Row title="作用于项目资源库"><Switch aria-label="文件类型徽标作用于项目资源库" checked={resources} onCheckedChange={(checked) => onChange({ fileTypeBadgesResources: checked })} /></Row>
      <div className="flex items-center gap-2 px-5 py-4 text-xs text-muted-foreground"><span>徽标样式</span><span className="rounded bg-violet-100 px-1.5 py-0.5 text-[10px] font-semibold text-violet-600">MD</span><span className="rounded bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-600">XLSX</span></div>
    </CollapsibleContent>
  </Collapsible>
}
