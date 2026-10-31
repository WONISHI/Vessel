import { ShapeSvg } from "@/components/image-toolbox/components/shape-svg"
import { Expand, ImageIcon, LoaderCircle, Maximize, PanelLeft, PanelRight, Undo2, ZoomIn, ZoomOut } from "lucide-react"
import { toast } from "sonner"
import type { ImageToolboxModel } from "@/components/image-toolbox/hooks/use-image-toolbox"

/** 中间预览区：预览工具条与画布 */
export function ImagePreview({ m }: { m: ImageToolboxModel }) {
  const { nav, setNav, image, history, tool, size, region, mattingProgress, busy, pan, setPan, panDrag, zoom, setZoom, settings, setSettings, setViewport, fileInput, root, shapes, draft, scale, selection, undo, annotating, move, down, up, cancel } = m

  return (
        <section className="image-preview-area">
          <div className="image-preview-toolbar">
            <button
              aria-label="缩小图片"
              disabled={!image || zoom <= 0.25}
              onClick={() => setZoom((z) => Math.max(0.25, z - 0.25))}
            >
              <ZoomOut />
            </button>
            <output>{Math.round(scale * 100)}%</output>
            <button
              aria-label="放大图片"
              disabled={!image || zoom >= 4}
              onClick={() => setZoom((z) => Math.min(4, z + 0.25))}
            >
              <ZoomIn />
            </button>
            <button
              aria-label="图片适应画布"
              onClick={() => {
                setZoom(1)
                setPan({ x: 0, y: 0 })
              }}
            >
              <Expand />
            </button>
            <button
              aria-label="撤销图片编辑"
              disabled={busy || (!history.length && !shapes.length && !draft)}
              onClick={undo}
            >
              <Undo2 />
            </button>
            <span className="image-toolbar-spacer" />
            <button
              aria-label="切换图片工具栏"
              aria-pressed={nav}
              onClick={() => setNav(!nav)}
            >
              <PanelLeft />
            </button>
            <button
              aria-label="切换图片设置面板"
              aria-pressed={settings}
              onClick={() => setSettings((v) => !v)}
            >
              <PanelRight />
            </button>
            <button
              aria-label="全屏预览"
              onClick={() => void (document.fullscreenElement ? document.exitFullscreen() : root.current?.requestFullscreen())?.catch((e) => toast.error(String(e)))}
            >
              <Maximize />
            </button>
          </div>
          <div
            ref={setViewport}
            className="image-viewport"
            onPointerDown={(event) => {
              if (!image || (event.target instanceof Element && event.target.closest(".image-picture") && (selection || annotating))) return
              event.currentTarget.setPointerCapture(event.pointerId)
              panDrag.current = { x: event.clientX, y: event.clientY, origin: pan }
            }}
            onPointerMove={(event) => {
              const drag = panDrag.current
              if (drag) setPan({ x: drag.origin.x + event.clientX - drag.x, y: drag.origin.y + event.clientY - drag.y })
            }}
            onPointerUp={() => {
              panDrag.current = null
            }}
            onPointerCancel={() => {
              panDrag.current = null
            }}
          >
            <div
              className="image-stage"
              style={{ width: "100%", height: "100%", transform: `translate(${pan.x}px, ${pan.y}px)` }}
            >
              {image ? (
                <div
                  className={"image-picture" + (selection ? " selecting" : "") + (annotating ? " annotating" : "")}
                  style={{ width: size.width * scale, height: size.height * scale }}
                  onPointerDown={down}
                  onPointerMove={move}
                  onPointerUp={up}
                  onPointerCancel={cancel}
                >
                  <img
                    src={image}
                    alt="待处理图片"
                    draggable={false}
                  />
                  {annotating && (
                    <svg
                      className="image-annotations"
                      viewBox={`0 0 ${size.width} ${size.height}`}
                    >
                      {[...shapes, ...(draft ? [draft] : [])].map((s, i) => (
                        <ShapeSvg
                          key={i}
                          s={s}
                        />
                      ))}
                    </svg>
                  )}
                  {selection && (
                    <div
                      className="image-crop"
                      data-handle="move"
                      style={{ left: region.x * scale, top: region.y * scale, width: region.width * scale, height: region.height * scale }}
                    >
                      {["nw", "ne", "sw", "se"].map((h) => (
                        <i
                          key={h}
                          data-handle={h}
                          className={"handle-" + h}
                        />
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <button
                  className="image-empty"
                  onClick={() => fileInput.current?.click()}
                >
                  <ImageIcon />
                  <strong>导入图片开始编辑</strong>
                  <span>PNG、JPEG、WebP · 本地处理</span>
                </button>
              )}
            </div>
            {busy && (
              <div
                className="image-processing"
                role="status"
              >
                <LoaderCircle className="animate-spin" />
                {mattingProgress || (tool === "ocr" ? "正在识别，请稍候…" : "正在处理图片…")}
              </div>
            )}
          </div>
        </section>
  )
}
