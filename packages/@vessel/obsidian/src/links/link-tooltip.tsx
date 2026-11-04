import React, { useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"

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
  onOpenUrl: _onOpenUrl
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
    const destination = url.trim()
    if (destination) onConfirm(destination, text || destination)
  }

  // Calculate position: preferred above anchor
  const popupHeight = 36
  const popupWidth = Math.min(240, window.innerWidth - 16)
  const gap = 8
  const isNearTop = anchor.top - popupHeight - gap < 10
  const preferredTop = isNearTop
    ? anchor.top + (anchor.height || 22) + gap
    : Math.max(gap, anchor.top - popupHeight - gap)
  const top = Math.max(gap, Math.min(window.innerHeight - popupHeight - gap, preferredTop))
  const left = Math.max(gap, Math.min(window.innerWidth - popupWidth - gap, anchor.left - 18))

  const arrowLeft = Math.max(7, Math.min(popupWidth - 21, anchor.left - left - 7))

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
      <input
        ref={inputRef}
        type="text"
        aria-label="链接地址"
        className="vessel-link-tooltip-input"
        placeholder="输入链接，回车确认"
        value={url}
        onChange={(event) => setUrl(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.nativeEvent.isComposing) {
            event.preventDefault()
            handleConfirm()
          }
        }}
      />
      <svg aria-hidden="true" width="14" height="8" viewBox="0 0 14 8" className={`vessel-link-tooltip-arrow ${isNearTop ? "arrow-top" : "arrow-bottom"}`} style={{ left: arrowLeft }}>
        <path d="M0 0H14L7 7Z" className="vessel-link-tooltip-arrow-fill" />
        <path d="M0 0L7 7L14 0" className="vessel-link-tooltip-arrow-edge" fill="none" />
      </svg>
    </div>,
    document.body
  )
}
