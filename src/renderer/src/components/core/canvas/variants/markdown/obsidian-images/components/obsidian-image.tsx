import { Image } from "@/components/ui/image"
import { parseImageReference, resizeImageReference } from "@vessel/obsidian"
import { Check, Copy, Link, Trash2, X } from "lucide-react"
import { useCallback, useEffect, useRef, useState } from "react"
import { toast } from "sonner"

/** Renders the obsidian image component. */
export function ObsidianImage({ reference, root, documentPath, onChange, onFocusAbove, onFocusBelow, readOnly = false }: { onFocusAbove?: () => void; onFocusBelow?: () => void; readOnly?: boolean; reference: string; root: string; documentPath: string; onChange: (reference: string) => void }) {
  const embed = parseImageReference(reference)!
  const [showLink, setShowLink] = useState(false)
  const [draftUrl, setDraftUrl] = useState(() => (embed ? embed.target : reference))
  const [copied, setCopied] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const nextUrl = embed ? embed.target : reference
    setDraftUrl(nextUrl)
  }, [reference])

  /** Handles copy link events. */
  const handleCopyLink = (e?: React.MouseEvent) => {
    e?.stopPropagation()
    const url = draftUrl.trim() || (embed ? embed.target : reference)
    if (!url) return
    void navigator.clipboard
      .writeText(url)
      .then(() => {
        setCopied(true)
        toast.success("已复制图片地址")
        setTimeout(() => setCopied(false), 1500)
      })
      .catch(() => {
        toast.error("复制失败")
      })
  }

  /** Copies a vault Wiki embed, importing remote or inline images before referencing them. */
  const copyReference = async () => {
    try {
      let reference: string
      if (/^https?:/i.test(embed.target)) {
        reference = (await window.electronAPI.saveObsidianImage(root, documentPath, { url: embed.target })).reference
      } else if (/^data:image\//i.test(embed.target)) {
        const bytes = new Uint8Array(await (await fetch(embed.target)).arrayBuffer())
        reference = (await window.electronAPI.saveObsidianImage(root, documentPath, { bytes })).reference
      } else {
        const name = embed.target.replace(/\\/g, "/").split("/").pop()!
        reference = `![[${name}]]`
      }
      await navigator.clipboard.writeText(reference)
      toast.success("已复制图片引用")
    } catch (error) { toast.error(String(error)) }
  }

  /** Loads source. */
  const loadSource = useCallback(() => (/^data:image\//.test(embed.target) ? Promise.resolve(embed.target) : window.electronAPI.readObsidianImage(root, documentPath, reference)), [embed.target, root, documentPath, reference])

  /** Performs the commit link operation. */
  const commitLink = () => {
    if (readOnly) return
    const trimmed = draftUrl.trim()
    if (!trimmed) {
      handleDelete()
      return
    }
    let updated = trimmed
    if (!/^!\[.*\]\(.*\)|\!\[\[.*\]\]$/.test(trimmed)) {
      const isWiki = reference.trim().startsWith("![[")
      if (isWiki) {
        const size = embed?.width ? `|${embed.width}` : ""
        updated = `![[${trimmed}${size}]]`
      } else {
        const alt = embed?.alt ?? ""
        const size = embed?.width ? `|${embed.width}` : ""
        updated = `![${alt}${size}](${trimmed})`
      }
    }
    if (updated !== reference) {
      onChange(updated)
      toast.success("图片地址已修改")
    }
    setShowLink(false)
  }

  /** Handles delete events. */
  const handleDelete = () => {
    if (readOnly) return
    onChange("")
    toast.success("已移除图片引用，原文件保留")
  }

  /** Handles open link events. */
  const handleOpenLink = () => {
    const url = embed ? embed.target : reference
    setDraftUrl(url)
    setShowLink(true)
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus()
        inputRef.current.setSelectionRange(0, 0)
        inputRef.current.scrollLeft = 0
      }
    }, 50)
  }

  return (
    <span
      className="vessel-obsidian-image relative block bg-white"
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          if (showLink) {
            const currentTarget = embed ? embed.target : reference
            if (draftUrl.trim() && draftUrl.trim() !== currentTarget) {
              commitLink()
            } else {
              setShowLink(false)
            }
          }
        }
      }}
      tabIndex={0}
    >
      {showLink && (
        <div
          className="vessel-image-link-bar mb-2 flex h-7 w-full max-w-full items-center gap-2 rounded-lg border border-stone-200/90 bg-white px-2.5 shadow-sm dark:border-stone-800 dark:bg-stone-900"
          style={{ height: 28 }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            type="button"
            className="vessel-image-link-copy-btn"
            data-title="点击复制图片地址，也可拖拽地址"
            aria-label="复制图片地址"
            draggable
            onDragStart={(e) => {
              e.stopPropagation()
              const url = draftUrl.trim() || (embed ? embed.target : reference)
              e.dataTransfer.setData("text/plain", url)
              e.dataTransfer.setData("text/uri-list", url)
              e.dataTransfer.effectAllowed = "copy"
            }}
            onClick={handleCopyLink}
          >
            {copied ? (
              <Check
                className="vessel-image-link-icon vessel-image-link-copied"
                size={13}
                strokeWidth={2}
                style={{ width: 13, height: 13, color: "#16a34a" }}
              />
            ) : (
              <>
                <Link
                  className="vessel-image-link-icon vessel-icon-default"
                  size={13}
                  strokeWidth={1.75}
                  style={{ width: 13, height: 13 }}
                />
                <Copy
                  className="vessel-image-link-icon vessel-icon-hover"
                  size={13}
                  strokeWidth={1.75}
                  style={{ width: 13, height: 13 }}
                />
              </>
            )}
          </button>
          <input
            ref={inputRef}
            type="text"
            value={draftUrl}
            disabled={readOnly}
            data-title={draftUrl}
            className="vessel-image-link-input flex-1 min-w-0 border-0 bg-transparent p-0 text-[11px] text-stone-700 outline-none placeholder:text-stone-400 focus:ring-0 dark:text-stone-200"
            style={{ fontSize: 11, fontFamily: '"Plus Jakarta Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif' }}
            placeholder="输入图片链接或路径"
            onChange={(e) => setDraftUrl(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault()
                commitLink()
              } else if (e.key === "Escape") {
                e.preventDefault()
                setShowLink(false)
              }
            }}
          />
          <div className="vessel-image-link-actions flex shrink-0 items-center gap-2.5">
            <span
              className="vessel-image-link-divider h-3 w-px bg-stone-200 dark:bg-stone-700"
              style={{ width: 1, height: 12 }}
            />
            <button
              type="button"
              className="vessel-image-link-btn vessel-image-link-save flex items-center gap-1 text-[11px] font-normal text-[#16a34a] transition-opacity hover:opacity-80"
              style={{ fontSize: 11, color: "#16a34a" }}
              onClick={commitLink}
              data-title="保存"
              aria-label="保存"
            >
              <Check
                className="vessel-image-link-btn-icon shrink-0 stroke-[2.25]"
                size={12}
                strokeWidth={2.25}
                style={{ width: 12, height: 12 }}
              />
              <span>保存</span>
            </button>
            {!readOnly && (
              <button
                type="button"
                className="vessel-image-link-btn vessel-image-link-delete flex items-center gap-1 text-[11px] font-normal text-[#dc2626] transition-opacity hover:opacity-80"
                style={{ fontSize: 11, color: "#dc2626" }}
                onClick={handleDelete}
                data-title="删除"
                aria-label="删除"
              >
                <Trash2
                  className="vessel-image-link-btn-icon shrink-0 stroke-[1.75]"
                  size={12}
                  strokeWidth={1.75}
                  style={{ width: 12, height: 12 }}
                />
                <span>删除</span>
              </button>
            )}
            <span
              className="vessel-image-link-divider h-3 w-px bg-stone-200 dark:bg-stone-700"
              style={{ width: 1, height: 12 }}
            />
            <button
              type="button"
              className="vessel-image-link-btn vessel-image-link-close flex items-center justify-center text-stone-400 transition-colors hover:text-stone-600 dark:hover:text-stone-200"
              onClick={() => setShowLink(false)}
              data-title="关闭"
              aria-label="关闭"
            >
              <X
                className="vessel-image-link-btn-icon shrink-0 stroke-[2]"
                size={12}
                strokeWidth={2}
                style={{ width: 12, height: 12 }}
              />
            </button>
          </div>
        </div>
      )}
      <Image
        sourceAddress={embed.target}
        onCopyReference={() => void copyReference()}
        remote={/^https?:/.test(embed.target)}
        onDownloadLocal={
          !readOnly && /^https?:/.test(embed.target)
            ? async () => {
                const saved = await window.electronAPI.saveObsidianImage(root, documentPath, { url: embed.target })
                onChange(embed.width ? resizeImageReference(saved.reference, embed.width) : saved.reference)
              }
            : undefined
        }
        onFocusAbove={readOnly ? undefined : onFocusAbove}
        onFocusBelow={readOnly ? undefined : onFocusBelow}
        onViewLink={handleOpenLink}
        onDelete={readOnly ? undefined : handleDelete}
        sourceKey={`${root}:${documentPath}:${reference}`}
        loadSource={loadSource}
        alt={embed.alt}
        width={embed.width}
        defaultWidthPercent={embed.width === undefined ? 75 : undefined}
        onResizeEnd={readOnly ? undefined : (width) => onChange(resizeImageReference(reference, width))}
      />
    </span>
  )
}
