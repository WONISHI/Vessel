import { useState } from "react"
import { ChevronDown } from "lucide-react"
import type { AppSettings } from "@vessel/type"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Switch } from "@/components/ui/switch"
import { Row } from "./row"

type GitSettings = Pick<AppSettings, "gitDecorationsEnabled">
export function GitDecorationSettings({ value, onChange }: { value: GitSettings; onChange: (patch: GitSettings) => void }) {
  const [open, setOpen] = useState(false)
  const enabled = value.gitDecorationsEnabled !== false
  return <Collapsible open={open} onOpenChange={setOpen} className="settings-card">
    <CollapsibleTrigger className="settings-section-trigger flex w-full items-center gap-3 p-5 text-left transition-colors hover:bg-muted/40">
      <div className="min-w-0 flex-1"><h3>Git 状态标记</h3><p className="mt-1 text-xs text-muted-foreground">{enabled ? "已开启" : "已关闭"} · 项目资源库</p></div><ChevronDown className={`size-4 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
    </CollapsibleTrigger>
    <CollapsibleContent className="border-t">
      <Row title="显示 Git 状态标记" description="按 Git 状态给文件名着色：文件右侧显示 M、A、U、D、C 字母，文件夹右侧显示圆点。仅在提交、切换分支等 Git 记录变化后更新"><Switch aria-label="显示 Git 状态标记" checked={enabled} onCheckedChange={(checked) => onChange({ gitDecorationsEnabled: checked })} /></Row>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-4 text-xs text-muted-foreground">
        <span><b className="text-[#895503]">M</b> 已修改</span><span><b className="text-[#587c0c]">A</b> 新增（已暂存）</span><span><b className="text-[#007100]">U</b> 未跟踪</span><span><b className="text-[#ad0707]">D</b> 已删除</span><span><b className="text-[#ad0707]">C</b> 冲突</span>
      </div>
    </CollapsibleContent>
  </Collapsible>
}
