import { useState, type ReactNode } from "react"
import { ChevronDown } from "lucide-react"
import type { AppSettings, DirectoryTreeDimensions, DirectoryTreeSettings } from "@vessel/type"
import { directoryTreeLimits, normalizeDirectoryTreeSettings } from "@vessel/utils"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Switch } from "@/components/ui/switch"
import { Input } from "@/components/ui/input"
import { Row } from "./row"

function Group({ title, summary, children }: { title: string; summary: string; children: ReactNode }) {
  return <Collapsible className="settings-card">
    <CollapsibleTrigger className="settings-section-trigger group flex w-full items-center gap-3 p-5 text-left transition-colors hover:bg-muted/40">
      <div className="min-w-0 flex-1"><h3>{title}</h3><p className="mt-1 text-xs text-muted-foreground">{summary}</p></div>
      <ChevronDown className="size-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
    </CollapsibleTrigger>
    <CollapsibleContent className="border-t">{children}</CollapsibleContent>
  </Collapsible>
}

function Pixels({ label, value, min, max, disabled, onChange }: { label: string; value: number; min: number; max: number; disabled?: boolean; onChange: (value: number) => void }) {
  const [draft, setDraft] = useState<string | null>(null)
  return <div className="flex items-center gap-2">
    <Input type="number" inputMode="numeric" aria-label={label} className="h-8 w-24 text-right text-xs tabular-nums" min={min} max={max} step={1} disabled={disabled} value={draft ?? value}
      onChange={(event) => {
        const text = event.target.value
        setDraft(text)
        const number = Number(text)
        if (text && Number.isFinite(number) && number >= min && number <= max) onChange(Math.round(number))
      }}
      onBlur={() => {
        const number = draft?.trim() ? Number(draft) : value
        if (Number.isFinite(number)) onChange(Math.max(min, Math.min(max, Math.round(number))))
        setDraft(null)
      }}
      onKeyDown={(event) => { if (event.key === "Enter") { event.preventDefault(); event.currentTarget.blur() } }}
    /><span className="text-xs text-muted-foreground">px</span>
  </div>
}

type Props = { value: Pick<AppSettings, "directoryTree">; onChange: (patch: Pick<AppSettings, "directoryTree">) => void }
export function DirectoryTreeSettingsPanel({ value, onChange }: Props) {
  const current = normalizeDirectoryTreeSettings(value.directoryTree)
  const update = (patch: Partial<DirectoryTreeSettings>) => onChange({ directoryTree: normalizeDirectoryTreeSettings({ ...current, ...patch }) })
  const dimension = (scope: "workspace" | "resources", key: keyof DirectoryTreeDimensions, number: number) => update({ [scope]: { ...current[scope], [key]: number } })
  const scopes = [{ key: "workspace", title: "工作区", flag: "Workspace" }, { key: "resources", title: "项目资源库", flag: "Resources" }] as const
  const summary = (kind: "layout" | "guides" | "gap") => {
    const enabled = current[`${kind}Enabled`]
    const names = scopes.filter((scope) => current[`${kind}${scope.flag}`]).map((scope) => scope.title)
    return `${enabled ? "已开启" : "已关闭"} · ${names.join("、") || "未启用应用范围"}`
  }
  const switchRow = (title: string, description: string | undefined, key: keyof Pick<DirectoryTreeSettings, "layoutEnabled" | "layoutWorkspace" | "layoutResources" | "guidesEnabled" | "guidesWorkspace" | "guidesResources" | "gapEnabled" | "gapWorkspace" | "gapResources" | "folderBoldWorkspace" | "folderBoldResources">, label = title) => <Row key={key} title={title} description={description}><Switch aria-label={label} checked={current[key]} onCheckedChange={(checked) => update({ [key]: checked })} /></Row>
  return <>
    <Group title="目录树布局" summary={summary("layout")}>
      {switchRow("启用紧凑目录布局", "使用紧凑行高、统一图标列和小缩进；超长文件名显示省略号。关闭的范围使用宽松布局。", "layoutEnabled")}
      {scopes.map((scope) => switchRow(`作用于${scope.title}`, undefined, `layout${scope.flag}`, `紧凑目录布局作用于${scope.title}`))}
      {scopes.map((scope) => <div key={scope.key} className="border-t">
        <h4 className="bg-muted/30 px-5 py-3 text-xs font-medium">{scope.title}尺寸</h4>
        {([{ key: "sidebarWidth", title: "侧栏宽度" }, { key: "rowHeight", title: "目录行高" }, { key: "fontSize", title: "目录字号" }, { key: "indent", title: "层级缩进" }] as const).map((field) => <Row key={field.key} title={field.title} description={field.key === "indent" ? "每深入一层增加的缩进，0 表示不缩进" : undefined}>
          <Pixels label={`${scope.title}${field.title}`} value={current[scope.key][field.key]} {...directoryTreeLimits[field.key]} min={field.key === "rowHeight" ? Math.max(directoryTreeLimits.rowHeight.min, current[scope.key].fontSize + 4) : directoryTreeLimits[field.key].min} disabled={!current.layoutEnabled || !current[`layout${scope.flag}`]} onChange={(number) => dimension(scope.key, field.key, number)} />
        </Row>)}
      </div>)}
    </Group>
    <Group title="目录树连线" summary={summary("guides")}>
      {switchRow("显示层级连线", "显示父子节点之间的缩进辅助线，可独立于紧凑布局开启。", "guidesEnabled")}
      {scopes.map((scope) => switchRow(`作用于${scope.title}`, undefined, `guides${scope.flag}`, `目录树连线作用于${scope.title}`))}
    </Group>
    <Group title="文件夹标题加粗" summary={`${scopes.filter((scope) => current[`folderBold${scope.flag}`]).map((scope) => scope.title).join("、") || "已关闭"}`}>
      {scopes.map((scope) => switchRow(`加粗${scope.title}的文件夹标题`, scope.key === "workspace" ? "文件夹名称使用粗体，文件名保持常规字重。" : undefined, `folderBold${scope.flag}`, `文件夹标题加粗：${scope.title}`))}
    </Group>
    <Group title="目录行间隙" summary={summary("gap")}>
      {switchRow("启用目录行间隙", "在相邻目录行之间增加留白；0px 表示紧密排列。", "gapEnabled")}
      {scopes.map((scope) => switchRow(`作用于${scope.title}`, undefined, `gap${scope.flag}`, `目录行间隙作用于${scope.title}`))}
      {scopes.map((scope) => <Row key={scope.key} title={`${scope.title}行间隙`}><Pixels label={`${scope.title}行间隙`} value={current[scope.key].gap} {...directoryTreeLimits.gap} disabled={!current.gapEnabled || !current[`gap${scope.flag}`]} onChange={(number) => dimension(scope.key, "gap", number)} /></Row>)}
    </Group>
  </>
}
