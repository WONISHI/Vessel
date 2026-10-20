import React, { useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { normalizeLinkUrl } from "#vessel-obsidian/links/markdown-link"

export interface LinkTooltipProps {
  anchor: { left: number; top: number; width?: number; height?: number }
  initialUrl?: string
  initialText?: string
  onConfirm: (url: string, text?: string) => void
  onClose: () => void
  onOpenUrl?: (url: string) => void
}

export const LinkTooltip: React.FC<LinkTooltipProps> = ({
  anchor,
  initialUrl = "",
  initialText = "",
  onConfirm,
  onClose,
  onOpenUrl
}) => {
  const [url, setUrl] = useState(initialUrl)
  const text = initialText
  const inputRef = useRef<HTMLInputElement>(null)
  const hostRef = useRef<HTMLDivElement>(null)

  // Auto-focus and select input on mount
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus()
      // If initial URL is placeholder like "https://", place cursor at end; otherwise select all
      if (inputRef.current.value === "https://") {
        inputRef.current.setSelectionRange(8, 8)
      } else {
        inputRef.current.select()
      }
    }
  }, [])

  // Close on outside pointer click or Escape
  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (hostRef.current && !hostRef.current.contains(event.target as Node)) {
        onClose()
      }
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation()
        onClose()
      }
    }
    document.addEventListener("pointerdown", handlePointerDown, true)
    document.addEventListener("keydown", handleKeyDown, true)
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown, true)
      document.removeEventListener("keydown", handleKeyDown, true)
    }
  }, [onClose])

  const handleConfirm = () => {
    const normalized = normalizeLinkUrl(url)
    onConfirm(normalized, text)
  }

  // Calculate position: preferred above anchor
  const popupHeight = 40
  const gap = 8
  const isNearTop = anchor.top - popupHeight - gap < 10
  const top = isNearTop
    ? anchor.top + (anchor.height || 22) + gap
    : Math.max(gap, anchor.top - popupHeight - gap)
  const left = Math.max(gap, Math.min(window.innerWidth - 320, anchor.left))
  const arrowLeft = Math.max(14, Math.min(290, (anchor.left + (anchor.width ? anchor.width / 2 : 12)) - left - 4))

  if (typeof document === "undefined") return null

  return createPortal(
    <div
      ref={hostRef}
      role="dialog"
      aria-label="链接地址"
      className="vessel-link-tooltip"
      style={{
        position: "fixed",
        left: `${left}px`,
        top: `${top}px`,
        zIndex: 280
      }}
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div className="vessel-link-tooltip-body">
        <svg
          className="vessel-link-tooltip-icon"
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
          <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
        </svg>

        <input
          ref={inputRef}
          type="text"
          className="vessel-link-tooltip-input"
          placeholder="输入或粘贴链接 (https://...)"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault()
              handleConfirm()
            }
          }}
        />

        <button
          type="button"
          className="vessel-link-tooltip-btn vessel-link-tooltip-confirm"
          title="确认链接 (Enter)"
          onClick={handleConfirm}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </button>

        {url.trim() && onOpenUrl && (
          <button
            type="button"
            className="vessel-link-tooltip-btn vessel-link-tooltip-open"
            title="在新标签页中打开"
            onClick={() => onOpenUrl(normalizeLinkUrl(url))}
          >
            <svg
              width="13"
              height="13"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
              <polyline points="15 3 21 3 21 9" />
              <line x1="10" y1="14" x2="21" y2="3" />
            </svg>
          </button>
        )}
      </div>
      {/* Tooltip triangle tail */}
      <div
        className={`vessel-link-tooltip-arrow ${isNearTop ? "arrow-top" : "arrow-bottom"}`}
        style={{
          left: `${arrowLeft}px`
        }}
      />
    </div>,
    document.body
  )
}
