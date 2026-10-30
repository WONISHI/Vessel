import { FileText, ClipboardList, Info, SquareCheck, Lightbulb, CircleCheck, CircleHelp, TriangleAlert, CircleX, ShieldCheck, Bug, TestTubes, Quote } from "lucide-react"
import { parseCalloutHeader } from "@vessel/obsidian"
import { ContextMenu, ContextMenuContent, ContextMenuItem } from "@/components/ui/context-menu"
import { MarkdownContextMenuAnchor } from "./context-menu-anchor"

const calloutChoices = [
  { label: "备注", name: "note", icon: FileText },
  { label: "摘要", name: "summary", icon: ClipboardList },
  { label: "信息", name: "info", icon: Info },
  { label: "待办", name: "todo", icon: SquareCheck },
  { label: "技巧", name: "hint", icon: Lightbulb },
  { label: "成功", name: "check", icon: CircleCheck },
  { label: "疑问", name: "help", icon: CircleHelp },
  { label: "警告", name: "caution", icon: TriangleAlert },
  { label: "失败", name: "fail", icon: CircleX },
  { label: "危险", name: "error", icon: ShieldCheck },
  { label: "缺陷", name: "bug", icon: Bug },
  { label: "示例", name: "example", icon: TestTubes },
  { label: "引用", name: "cite", icon: Quote }
]


export function CalloutTypeItems({ onSelect, currentType }: { onSelect: (name: string) => void; currentType?: string }) {
  return calloutChoices.map((choice) => (
    <ContextMenuItem key={choice.name} aria-label={choice.label} data-selected={currentType === parseCalloutHeader(`[!${choice.name}]`)?.type || undefined} onSelect={() => onSelect(choice.name)}>
      <choice.icon />
      <span className="markdown-callout-choice-text"><strong>{choice.label}</strong><small>[!{choice.name}]</small></span>
    </ContextMenuItem>
  ))
}

export function CalloutTypeMenu({ x, y, currentType, onSelect, onClose }: { x: number; y: number; currentType?: string; onSelect: (name: string) => void; onClose: () => void }) {
  return (
    <ContextMenu modal={false} onOpenChange={(open) => { if (!open) onClose() }}>
      <MarkdownContextMenuAnchor x={x} y={y} label="更改 Callout 类型" />
      <ContextMenuContent className="markdown-insert-menu markdown-callout-picker" collisionPadding={8} onCloseAutoFocus={(event) => event.preventDefault()}>
        <CalloutTypeItems currentType={currentType} onSelect={onSelect} />
      </ContextMenuContent>
    </ContextMenu>
  )
}
