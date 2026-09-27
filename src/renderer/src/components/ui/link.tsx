import { createPortal } from "react-dom"
import { forwardRef, useEffect, useRef, useState, type ComponentPropsWithoutRef, type ReactNode } from "react"
import { PopoverAnchor } from "@radix-ui/react-popover"
import { Copy, ExternalLink } from "lucide-react"
import { toast } from "sonner"
import { Popover, PopoverContent } from "./popover"
import { Button } from "./button"
import { cn } from "@/lib/utils"

/** React 链接与富文本编辑器链接共用的样式。 */
const linkClassName = "text-primary underline underline-offset-4 hover:opacity-80 focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"

export interface LinkAction {
  /** 操作的稳定标识。 */
  id: string
  label: string
  icon?: ReactNode
  onSelect: (href: string) => void | Promise<void>
}
/** 链接操作容器；兼容 React 链接和编辑器生成的 anchor，actions 可扩展应用内浏览器入口。 */
export function LinkInteractionArea({ children, actions = [], className, inline = false }: { children: ReactNode; actions?: readonly LinkAction[]; className?: string; inline?: boolean }) {
  const host = useRef<HTMLDivElement & HTMLSpanElement>(null)
  useEffect(() => {
    const element = host.current
    if (!element) return
    const apply = () =>
      element.querySelectorAll<HTMLElement>('a[href], [data-type="a"] .vditor-ir__link').forEach((anchor) => {
        if (/^(https?:|mailto:)/i.test(anchor.getAttribute("href") || anchor.parentElement?.querySelector(".vditor-ir__marker--link")?.textContent || "")) {
          anchor.classList.add(...linkClassName.split(" "))
          anchor.dataset.vesselLink = "true"
        }
      })
    apply()
    const observer = new MutationObserver(apply)
    observer.observe(element, { childList: true, subtree: true })
    return () => observer.disconnect()
  }, [])
  const Container = inline ? "span" : "div"
  const [target, setTarget] = useState<{ href: string; x: number; y: number } | null>(null)
  const resolve = (element: EventTarget) => {
    const anchor = element instanceof Element ? element.closest('a[href], [data-type="a"]') : null
    const href = anchor?.getAttribute("href") || anchor?.querySelector(".vditor-ir__marker--link")?.textContent
    return href && /^(https?:|mailto:)/i.test(href) ? href : null
  }
  const run = async (action: () => void | Promise<void>) => {
    setTarget(null)
    try {
      await action()
    } catch (error) {
      toast.error(String(error))
    }
  }
  return (
    <Popover
      open={!!target}
      onOpenChange={(open) => {
        if (!open) setTarget(null)
      }}
    >
      <Container
        ref={host}
        className={className}
        onContextMenuCapture={(event) => {
          const href = resolve(event.target)
          if (!href) return
          event.preventDefault()
          event.stopPropagation()
          setTarget({ href, x: event.clientX, y: event.clientY })
        }}
        onClickCapture={(event) => {
          const href = resolve(event.target)
          if (!href) return
          event.preventDefault()
          event.stopPropagation()
          void run(() => window.electronAPI.openExternal(href))
        }}
      >
        {children}
      </Container>
      {createPortal(
        <PopoverAnchor asChild>
          <span style={{ width: 0, height: 0, position: "fixed", left: target?.x ?? 0, top: target?.y ?? 0 }} />
        </PopoverAnchor>,
        document.body
      )}
      <PopoverContent
        align="start"
        className="w-44 min-w-0 p-1"
        onOpenAutoFocus={(event) => event.preventDefault()}
      >
        <Button
          variant="ghost"
          className="h-8 w-full justify-start gap-2 px-2 text-[11px] hover:bg-emerald-700 hover:!text-white [&:hover_svg]:!text-white"
          onClick={() => {
            if (target) void run(() => window.electronAPI.openExternal(target.href))
          }}
        >
          <ExternalLink className="!size-3.5" />
          在默认浏览器中打开
        </Button>
        <Button
          variant="ghost"
          className="h-8 w-full justify-start gap-2 px-2 text-[11px] hover:bg-emerald-700 hover:!text-white [&:hover_svg]:!text-white"
          onClick={() => {
            if (target)
              void run(async () => {
                await navigator.clipboard.writeText(target.href)
                toast.success("链接已复制")
              })
          }}
        >
          <Copy className="!size-3.5" />
          复制链接
        </Button>
        {actions.map((action) => (
          <Button
            key={action.id}
            variant="ghost"
            className="h-8 w-full justify-start gap-2 px-2 text-[11px] hover:bg-emerald-700 hover:!text-white [&:hover_svg]:!text-white"
            onClick={() => {
              if (target) void run(() => action.onSelect(target.href))
            }}
          >
            {action.icon}
            {action.label}
          </Button>
        ))}
      </PopoverContent>
    </Popover>
  )
}

export interface LinkProps extends ComponentPropsWithoutRef<"a"> {
  /** 扩展右键操作，例如“在工作区中打开”。 */
  actions?: readonly LinkAction[]
}
/** 使用 shadcn 视觉样式的通用链接，提供外部打开、复制及可扩展操作菜单。 */
export const Link = forwardRef<HTMLAnchorElement, LinkProps>(({ actions, className, ...props }, ref) => (
  <LinkInteractionArea
    inline
    actions={actions}
    className="contents"
  >
    <a
      ref={ref}
      className={cn(linkClassName, className)}
      {...props}
    />
  </LinkInteractionArea>
))
Link.displayName = "Link"
