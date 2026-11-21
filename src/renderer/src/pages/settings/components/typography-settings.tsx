import type { AppSettings } from "@vessel/type"
import { ChevronDown } from "lucide-react"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"
import { fonts } from "./index-shared"
import { Row } from "./row"

const editorFonts = ["Menlo", "Monaco", "Consolas", "SF Mono", "JetBrains Mono", "Fira Code", "Cascadia Code", "monospace"]
type Typography = Pick<AppSettings, "font" | "fontSize" | "editorFont" | "editorFontSize">
export function TypographySettings({ value, onChange }: { value: Typography; onChange: (patch: Partial<Typography>) => void }) {
  const fontRows = [
    { key: "font" as const, title: "界面字体", description: "用于界面和 Markdown 正文，缺失时使用系统字体", fonts, selected: value.font },
    { key: "editorFont" as const, title: "编辑器字体", description: "仅用于代码编辑器，缺失时回退到等宽字体", fonts: editorFonts, selected: value.editorFont ?? "Menlo" }
  ]
  const sizeRows = [
    { key: "fontSize" as const, title: "界面字体大小", description: "调整界面基础大小（12–18 px）", min: 12, max: 18, selected: value.fontSize },
    { key: "editorFontSize" as const, title: "编辑器字体大小", description: "仅调整代码编辑器文字（10–32 px）", min: 10, max: 32, selected: value.editorFontSize ?? 14 }
  ]
  return <>
    <Collapsible defaultOpen className="settings-card">
      <CollapsibleTrigger className="settings-section-trigger group flex w-full items-center gap-3 p-5 text-left hover:bg-muted/40">
        <div className="flex-1"><h3>字体</h3><p className="mt-1 text-xs text-muted-foreground">分别设置界面与代码编辑器使用的字体</p></div>
        <ChevronDown className="size-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
      </CollapsibleTrigger>
      <CollapsibleContent className="border-t">{fontRows.map(row => <Row key={row.key} title={row.title} description={row.description}>
        <Select value={row.selected} onValueChange={next => { if (next) onChange({ [row.key]: next }) }}>
          <SelectTrigger aria-label={row.title} className="w-[200px]"><SelectValue /></SelectTrigger>
          <SelectContent>{row.fonts.map(font => <SelectItem key={font} value={font}>{font}</SelectItem>)}</SelectContent>
        </Select>
      </Row>)}</CollapsibleContent>
    </Collapsible>
    <Collapsible defaultOpen className="settings-card">
      <CollapsibleTrigger className="settings-section-trigger group flex w-full items-center gap-3 p-5 text-left hover:bg-muted/40">
        <div className="flex-1"><h3>字体大小</h3><p className="mt-1 text-xs text-muted-foreground">分别调整界面大小与代码编辑器字号</p></div>
        <ChevronDown className="size-4 text-muted-foreground transition-transform group-data-[state=open]:rotate-180" />
      </CollapsibleTrigger>
      <CollapsibleContent className="border-t">{sizeRows.map(row => <Row key={row.key} title={row.title} description={row.description}>
        <div className="flex w-[200px] items-center gap-3">
          <Slider aria-label={row.title} min={row.min} max={row.max} step={1} value={[row.selected]} onValueChange={next => { if (next[0] !== undefined) onChange({ [row.key]: next[0] }) }} />
          <span className="shrink-0 text-xs tabular-nums">{row.selected}px</span>
        </div>
      </Row>)}</CollapsibleContent>
    </Collapsible>
  </>
}
