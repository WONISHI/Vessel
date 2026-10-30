import { parseWikiLinks } from "./index.js"
import React, { cloneElement, useEffect, useId, useRef, useState, type InputHTMLAttributes, type ReactElement } from "react"
import { createPortal } from "react-dom"

export interface WikiFileSuggestion {
  path: string
  label: string
}

/** Find the wikilink being edited, preserving suffix text and existing closing brackets. */
export function wikiCompletionAt(text: string, caret: number) {
  const start = text.lastIndexOf("[[", caret)
  if (start < 0 || (start > 0 && /[!\\]/.test(text[start - 1]))) return null
  const query = text.slice(start + 2, caret)
  if (/[\[\]\n|#]/.test(query)) return null
  const closing = text.indexOf("]]", caret)
  const suffix = text.slice(caret, closing < 0 ? text.length : closing)
  const end = closing >= 0 && !/[\[\]\n]/.test(suffix) ? closing + 2 : caret
  return { start, end, query }
}

/** Input adapter with a portal suggestion tooltip; callers supply workspace file access. */
export function WikiLinkInput<T extends HTMLInputElement | HTMLTextAreaElement>({ input, search, renderScrollArea = (children) => <div style={{ maxHeight: 192, overflowY: "auto", overflowX: "hidden" }}>{children}</div> }: { renderScrollArea?: (children: React.ReactNode) => React.ReactNode; input: ReactElement<InputHTMLAttributes<T>>; search: (query: string, signal?: AbortSignal) => Promise<WikiFileSuggestion[]> }) {
  const generatedId = useId()
  const inputId = input.props.id || generatedId
  const ref = useRef<T>(null)
  const popup = useRef<HTMLDivElement>(null)
  const [range, setRange] = useState<ReturnType<typeof wikiCompletionAt>>(null)
  const [items, setItems] = useState<WikiFileSuggestion[]>([])
  const [active, setActive] = useState(0)
  const [visibleCount, setVisibleCount] = useState(30)
  const [error, setError] = useState("")
  const [busy, setBusy] = useState(false)
  const [position, setPosition] = useState({ left: 0, top: 0, above: false })
  const update = (element: T) => {
    setRange(wikiCompletionAt(element.value, element.selectionStart ?? element.value.length))
    const rect = element.getBoundingClientRect()
    const above = window.innerHeight - rect.bottom < 210 && rect.top > 210
    setPosition({ left: Math.max(8, Math.min(rect.left, window.innerWidth - 296)), top: above ? rect.top - 8 : rect.bottom + 8, above })
  }
  useEffect(() => {
    setItems([])
    setActive(0)
    setVisibleCount(30)
    setError("")
    if (!range) return
    let cancelled = false
    const controller = new AbortController()
    setBusy(true)
    const timer = setTimeout(() => {
      void search(range.query, controller.signal)
        .then(
          (files) => {
            if (!cancelled) setItems(files)
          },
          () => {
            if (!cancelled) setError("无法读取工作区文件")
          }
        )
        .finally(() => {
          if (!cancelled) setBusy(false)
        })
    }, 120)
    return () => {
      cancelled = true
      controller.abort()
      clearTimeout(timer)
    }
  }, [range?.query, Boolean(range), search])
  useEffect(() => {
    if (!range) return
    const close = () => setRange(null)
    window.addEventListener("resize", close)
    const scroll = (event: Event) => {
      if (!popup.current?.contains(event.target as Node)) close()
    }
    window.addEventListener("scroll", scroll, true)
    return () => {
      window.removeEventListener("resize", close)
      window.removeEventListener("scroll", scroll, true)
    }
  }, [Boolean(range)])
  useEffect(() => {
    if (active >= visibleCount) { setVisibleCount((count) => Math.max(count + 30, active + 1)); return }
    popup.current?.querySelector('[aria-selected="true"]')?.scrollIntoView?.({ block: "nearest" })
  }, [active, visibleCount])
  const choose = (item: WikiFileSuggestion) => {
    const element = ref.current
    if (!element || !range) return
    const replacement = `[[${item.path}]]`
    const next = element.value.slice(0, range.start) + replacement + element.value.slice(range.end)
    // Invoke the original controlled input handler without mutating source outside its owner.
    input.props.onChange?.({ target: { value: next }, currentTarget: element } as React.ChangeEvent<T>)
    const caret = range.start + replacement.length
    setRange(null)
    requestAnimationFrame(() => {
      element.focus()
      element.setSelectionRange(caret, caret)
    })
  }
  return (
    <>
      {cloneElement(input, {
        ref,
        id: inputId,
        role: "combobox",
        "aria-expanded": Boolean(range),
        "aria-label": input.props["aria-label"] || "单元格内容",
        onChange: (event: React.ChangeEvent<T>) => {
          input.props.onChange?.(event)
          if (!(event.nativeEvent as InputEvent).isComposing) update(event.currentTarget)
        },
        onCompositionEnd: (event: React.CompositionEvent<T>) => {
          input.props.onCompositionEnd?.(event)
          update(event.currentTarget)
        },
        onClick: (event: React.MouseEvent<T>) => {
          input.props.onClick?.(event)
          update(event.currentTarget)
        },
        onBlur: (event: React.FocusEvent<T>) => {
          setRange(null)
          input.props.onBlur?.(event)
        },
        onKeyDown: (event: React.KeyboardEvent<T>) => {
          if (event.nativeEvent.isComposing) return
          if (range && ["ArrowDown", "ArrowUp", "Enter", "Escape"].includes(event.key)) {
            event.preventDefault()
            event.stopPropagation()
            if (event.key === "Escape") setRange(null)
            else if (event.key === "Enter") {
              if (items[active]) choose(items[active])
            } else if (items.length) setActive((value) => (value + (event.key === "ArrowDown" ? 1 : -1) + items.length) % items.length)
            return
          }
          input.props.onKeyDown?.(event)
          if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key))
            requestAnimationFrame(() => {
              if (ref.current) update(ref.current)
            })
        }
      } as InputHTMLAttributes<T>)}
      {range &&
        createPortal(
          <div
            ref={popup}
            data-cell-editor-anchor={inputId}
            onScrollCapture={(event) => {
              const viewport = event.target as HTMLElement
              if (viewport.clientHeight > 0 && viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight < 48) setVisibleCount((count) => Math.min(items.length, count + 30))
            }}
            role="listbox"
            aria-label="双链文件建议"
            onMouseDown={(event) => {
              event.preventDefault()
              event.stopPropagation()
            }}
            style={{
              position: "fixed",
              zIndex: 400,
              left: position.left,
              top: position.top,
              transform: position.above ? "translateY(-100%)" : undefined,
              width: 280,
              maxWidth: "calc(100vw - 16px)",
              maxHeight: 200,
              overflow: "hidden",
              background: "var(--wiki-completion-background, #fff)",
              color: "var(--wiki-completion-foreground, #292524)",
              border: "1px solid var(--wiki-completion-border, #d6d3d1)",
              borderRadius: 8,
              padding: 4,
              boxShadow: "var(--wiki-completion-shadow, 0 4px 18px #0002)",
              fontSize: 12
            }}
          >
            {renderScrollArea(busy ? (
              <div style={{ padding: 8 }}>正在查找…</div>
            ) : error ? (
              <div style={{ padding: 8 }}>{error}</div>
            ) : !items.length ? (
              <div style={{ padding: 8 }}>没有匹配的文件</div>
            ) : (
              items.slice(0, visibleCount).map((item, index) => (
                <div
                  key={item.path}
                  role="option"
                  aria-selected={index === active}
                  onMouseEnter={() => setActive(index)}
                  onClick={() => choose(item)}
                  style={{ padding: "6px 8px", borderRadius: 4, cursor: "pointer", background: active === index ? "var(--wiki-completion-selected, #e8f7ee)" : undefined, color: active === index ? "var(--wiki-completion-selected-text, #15803d)" : undefined }}
                >
                  <div style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.label}</div>
                  <small style={{ display: "block", opacity: 0.6, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.path}</small>
                </div>
              ))
            ))}
          </div>,
          document.body
        )}
    </>
  )
}

/** Render wikilinks without converting the stored cell text to HTML. */
export function WikiLinkText({ text, onOpen }: { text: string; onOpen: (target: string) => void }) {
  const parts: React.ReactNode[] = []
  let offset = 0
  for (const link of parseWikiLinks(text)) {
    parts.push(text.slice(offset, link.index))
    parts.push(
      <button
        key={link.index}
        data-wiki-target={link.target}
        data-wiki-label={link.label}
        type="button"
        style={{ color: "#16a34a", textDecoration: "underline", border: 0, background: "transparent", padding: 0, font: "inherit", cursor: "pointer" }}
        onMouseDown={(event) => event.stopPropagation()}
        onClick={(event) => {
          event.stopPropagation()
          onOpen(link.target)
        }}
      >
        {link.label}
      </button>
    )
    offset = link.index + link.raw.length
  }
  parts.push(text.slice(offset))
  return <>{parts}</>
}
