import { createMarkdownTableDocument } from "@/components/core/canvas/variants/markdown-table/document"
import { useLayoutEffect, useRef } from "react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuPortal, DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubContent, DropdownMenuSubTrigger, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { ScrollArea } from "@/components/ui/scroll-area"
import { ClipboardPaste, FolderOpen, Code, CodeXml, Heading, ImagePlus, LayoutGrid, Link, List, ListChecks, ListOrdered, Milestone, Minus, Quote, Table2, TableProperties, Workflow } from "lucide-react"

const groups = [
  { label: "插入", items: [
    { label: "插入标题", icon: Heading, children: ["一级标题", "二级标题", "三级标题", "四级标题", "五级标题", "六级标题"].map((label, index) => ({ label, badge: `H${index + 1}`, value: `${"#".repeat(index + 1)} 标题` })) },
    { label: "插入链接", icon: Link, value: "link" },
    { label: "插入图片", icon: ImagePlus, children: [
      { label: "粘贴剪贴板图片", icon: ClipboardPaste, value: "image-clipboard" },
      { label: "从本机选择图片", icon: FolderOpen, value: "image" }
    ] }
  ] },
  { label: "块", items: [
    { label: "列表", icon: List, children: [
      { label: "无序列表", icon: List, value: "- 列表项" },
      { label: "有序列表", icon: ListOrdered, value: "1. 列表项" },
      { label: "任务列表", icon: ListChecks, value: "- [ ] 待办事项" }
    ] },
    { label: "引用", icon: Quote, value: "> 引用内容" },
    { label: "代码", icon: Code, children: [
      { label: "代码块", icon: CodeXml, value: "code-block" },
      { label: "行内代码", icon: Code, value: "`代码`", inline: true }
    ] },
    { label: "插入表格", icon: Table2, value: "| 标题一 | 标题二 |\n| --- | --- |\n| 内容 | 内容 |" },
    { label: "插入分割线", icon: Minus, value: "---" }
  ] },
  { label: "", items: [
    { label: "添加组件", icon: LayoutGrid, children: [
      { label: "时间线", icon: Milestone, value: "```timeline\n- 第一个事件\n  - 事件说明\n- 第二个事件\n  - 事件说明\n```" },
      { label: "步骤条", icon: Workflow, value: "```steps\n1. 第一步\n   - 步骤说明\n2. 第二步\n   - 步骤说明\n```" },
      {
        label: "高级表格",
        icon: TableProperties,
        value: "```markdown-table\n" + createMarkdownTableDocument("表格标题.markdowntable") + "\n```"
      }
    ] }
  ] }
]

/** Shows the Markdown insertion actions at the saved context-menu position. */
export function MarkdownInsertMenu({ x, y, onClose, onInsert, preserveEditorFocus = false }: { preserveEditorFocus?: boolean; x: number; y: number; onClose: () => void; onInsert: (value: string, inline?: boolean) => void }) {
  const editorFocus = useRef({ element: document.activeElement, range: window.getSelection()?.rangeCount ? window.getSelection()!.getRangeAt(0).cloneRange() : null })
  useLayoutEffect(() => {
    if (!preserveEditorFocus) return
    const frame = requestAnimationFrame(() => {
      const { element, range } = editorFocus.current
      if (!(element instanceof HTMLElement) || !element.isConnected) return
      element.focus({ preventScroll: true })
      if (range?.startContainer.isConnected) {
        window.getSelection()?.removeAllRanges()
        window.getSelection()?.addRange(range)
      }
    })
    return () => cancelAnimationFrame(frame)
  }, [preserveEditorFocus])
  return (
    <DropdownMenu open modal={false} onOpenChange={(open) => { if (!open) onClose() }}>
      <DropdownMenuTrigger aria-label="Markdown 插入菜单" style={{ position: "fixed", left: x, top: y, width: 0, height: 0, pointerEvents: "none" }} />
      <DropdownMenuContent className="markdown-insert-menu markdown-insert-menu-scroll" align="start" sideOffset={4} collisionPadding={8} onCloseAutoFocus={(event) => event.preventDefault()} onFocusOutside={(event) => event.preventDefault()}>
        <ScrollArea className="markdown-insert-scroll">
        <div className="markdown-insert-scroll-inner">
        {groups.map((group, index) => (
          <div key={index}>
            {index > 0 && <DropdownMenuSeparator />}
            {group.label && <DropdownMenuLabel className="markdown-insert-category">{group.label}</DropdownMenuLabel>}
            {group.items.map((item) => "children" in item ? (
              <DropdownMenuSub key={item.label}>
                <DropdownMenuSubTrigger><item.icon /><span>{item.label}</span></DropdownMenuSubTrigger>
                <DropdownMenuPortal>
                  <DropdownMenuSubContent className="markdown-insert-menu markdown-insert-submenu" collisionPadding={8}>
                    {item.children.map((child) => (
                      <DropdownMenuItem key={child.label} onSelect={() => onInsert(child.value, "inline" in child && child.inline === true)}>
                        {"badge" in child ? <span className="markdown-insert-heading">{child.badge}</span> : <child.icon />}
                        {child.label}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuSubContent>
                </DropdownMenuPortal>
              </DropdownMenuSub>
            ) : <DropdownMenuItem key={item.label} onSelect={() => onInsert(item.value, item.label === "插入链接")}><item.icon />{item.label}</DropdownMenuItem>)}
          </div>
        ))}
        </div>
        </ScrollArea>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
