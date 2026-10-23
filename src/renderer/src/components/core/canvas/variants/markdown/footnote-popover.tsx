import { useMemo, useRef, useState } from "react"
import { Superscript, X } from "lucide-react"
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"

export function FootnotePopover({ text, range, onCancel, onInsert }: { text: string; range: Range; onCancel: (restoreSelection?: boolean) => void; onInsert: (content: string) => void }) {
  const [content, setContent] = useState("")
  const input = useRef<HTMLTextAreaElement>(null)
  const anchor = useMemo(() => ({ current: { getBoundingClientRect: () => range.getBoundingClientRect(), contextElement: range.startContainer.parentElement ?? undefined } }), [range])
  return (
    <Popover
      open
      modal={false}
      onOpenChange={(open) => {
        if (!open) onCancel(false)
      }}
    >
      <PopoverAnchor virtualRef={anchor} />
      <PopoverContent
        side="bottom"
        align="start"
        sideOffset={8}
        collisionPadding={12}
        aria-label="添加脚注"
        className="z-[100] w-[300px] max-w-[calc(100vw-24px)] rounded-xl border bg-popover p-3 text-popover-foreground shadow-lg"
        onOpenAutoFocus={(event) => {
          event.preventDefault()
          input.current?.focus({ preventScroll: true })
        }}
        onCloseAutoFocus={(event) => event.preventDefault()}
        onEscapeKeyDown={(event) => {
          event.preventDefault()
          onCancel(true)
        }}
      >
        <div className="mb-2 flex items-center gap-1.5">
          <Superscript className="size-3.5 text-muted-foreground" />
          <span className="text-xs font-semibold">脚注</span>
          <button
            type="button"
            aria-label="关闭脚注输入"
            onClick={() => onCancel(true)}
            className="ml-auto flex size-5 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="size-3.5" />
          </button>
        </div>
        <p
          className="mb-2 truncate border-l-2 border-green-500 pl-2 text-[11px] text-muted-foreground"
          title={text}
        >
          {text}
        </p>
        <Textarea
          ref={input}
          aria-label="脚注内容"
          rows={3}
          className="min-h-[72px] resize-none rounded-xl border-stone-200 bg-[#faf9f7] px-3 py-2.5 text-xs text-stone-700 transition-[border-color,box-shadow,background-color] duration-150 placeholder:text-stone-400 focus-visible:border-green-600 focus-visible:ring-[3px] focus-visible:ring-green-600/10 focus-visible:ring-offset-0 dark:border-[#414954] dark:bg-[#1c2025] dark:text-slate-200 dark:placeholder:text-slate-500 dark:focus-visible:border-green-500 dark:focus-visible:ring-green-500/15 md:text-xs"
          placeholder="填写补充说明或来源…"
          value={content}
          onChange={(event) => setContent(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && (event.metaKey || event.ctrlKey) && !event.nativeEvent.isComposing && content.trim()) {
              event.preventDefault()
              onInsert(content)
            }
          }}
        />
        <div className="mt-2 flex items-center justify-between gap-2">
          <span className="text-[10px] text-muted-foreground">{/Mac/.test(navigator.platform) ? "⌘" : "Ctrl"} + Enter 添加</span>
          <Button
            size="sm"
            className="h-7 px-2.5 text-xs"
            disabled={!content.trim()}
            onClick={() => onInsert(content)}
          >
            添加脚注
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}
