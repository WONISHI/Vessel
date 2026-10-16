import { Button } from "@/components/ui/button"
import { LinkAction, linkClassName } from "@/components/ui/link/components/link-shared"
import { Popover, PopoverContent } from "@/components/ui/popover"
import { openInAppBrowser } from "@/lib/app-browser"
import { PopoverAnchor } from "@radix-ui/react-popover"
import { useRouter } from "@vessel/react-router"
import { Copy, ExternalLink, Globe } from "lucide-react"
import { useEffect, useRef, useState, type ReactNode } from "react"
import { createPortal } from "react-dom"
import { toast } from "sonner"

/** Renders the link interaction area component. */
export function LinkInteractionArea({ children, actions = [], className, inline = false }: { children: ReactNode; actions?: readonly LinkAction[]; className?: string; inline?: boolean }) {
  const router = useRouter()
  const host = useRef<HTMLDivElement & HTMLSpanElement>(null)
  useEffect(() => {
    const element = host.current
    if (!element) return

    /** Applies apply. */
    const apply = () => {
      {
        const walker = document.createTreeWalker(element, NodeFilter.SHOW_TEXT)
        const nodes: Text[] = []
        while (walker.nextNode()) {
          const node = walker.currentNode as Text
          const selection = window.getSelection()
          if (element.contains(document.activeElement) && (selection?.anchorNode === node || selection?.focusNode === node)) continue
          if (!node.parentElement?.closest('a,code,pre,button,[data-type="a"],[data-type="img"],[data-vessel-href],.vditor-ir__marker') && /https?:\/\/[^\s<>"'，。；）]+/.test(node.data)) nodes.push(node)
        }
        for (const node of nodes) {
          const fragment = document.createDocumentFragment()
          let offset = 0
          for (const match of node.data.matchAll(/https?:\/\/[^\s<>"'，。；）]+/g)) {
            fragment.append(node.data.slice(offset, match.index))
            const link = document.createElement("span")
            link.dataset.vesselHref = match[0]
            link.dataset.vesselLink = "true"
            link.className = linkClassName + " cursor-pointer"
            link.setAttribute("role", "link")
            link.tabIndex = 0
            link.textContent = match[0]
            fragment.append(link)
            offset = match.index + match[0].length
          }
          fragment.append(node.data.slice(offset))
          node.replaceWith(fragment)
        }
      }
      element.querySelectorAll<HTMLElement>('a[href], [data-type="a"] .vditor-ir__link, [data-type="a"]:not(:has(.vditor-ir__link))').forEach((anchor) => {
        const href = anchor.getAttribute("href") || anchor.closest('[data-type="a"]')?.querySelector(".vditor-ir__marker--link")?.textContent || anchor.textContent?.trim() || ""
        if (/^(https?:|mailto:)/i.test(href)) {
          anchor.classList.add(...linkClassName.split(" "), "cursor-pointer")
          anchor.dataset.vesselLink = "true"
          if (!anchor.hasAttribute("href")) anchor.dataset.vesselHref = href
        }
      })
    }
    element.addEventListener("focusout", apply)
    apply()
    const observer = new MutationObserver(apply)
    observer.observe(element, { childList: true, subtree: true, characterData: true })
    return () => {
      observer.disconnect()
      element.removeEventListener("focusout", apply)
    }
  }, [])
  const Container = inline ? "span" : "div"
  const [target, setTarget] = useState<{ href: string; x: number; y: number } | null>(null)

  /** Resolves resolve. */
  const resolve = (element: EventTarget) => {
    const anchor = element instanceof Element ? element.closest('a[href], [data-type="a"], [data-vessel-href]') : null
    const href = anchor?.getAttribute("data-vessel-href") || anchor?.getAttribute("href") || anchor?.querySelector(".vditor-ir__marker--link")?.textContent
    return href && /^(https?:|mailto:)/i.test(href) ? href : null
  }

  /** Runs run. */
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
        onKeyDownCapture={(event) => {
          if (event.key !== "Enter") return
          const href = resolve(event.target)
          if (href) {
            event.preventDefault()
            event.stopPropagation()
            void run(() => window.electronAPI.openExternal(href))
          }
        }}
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
        {target && /^https?:/i.test(target.href) && (
          <Button
            variant="ghost"
            className="h-8 w-full justify-start gap-2 px-2 text-[11px] hover:bg-emerald-700 hover:!text-white [&:hover_svg]:!text-white"
            onClick={() => {
              const href = target.href
              void run(() => openInAppBrowser(href, (path) => router.push(path)))
            }}
          >
            <Globe className="!size-3.5" />
            在内置浏览器中打开
          </Button>
        )}
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
