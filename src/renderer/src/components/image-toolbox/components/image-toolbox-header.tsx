import { Action } from "@/components/image-toolbox/components/action"
import { Clipboard, Download, ImageIcon, RotateCcw, Trash2, Undo2, Upload } from "lucide-react"
import type { ImageToolboxModel } from "@/components/image-toolbox/hooks/use-image-toolbox"

/** 顶部标题与导入导出操作 */
export function ImageToolboxHeader({ m }: { m: ImageToolboxModel }) {
  const { history, busy, fileInput, shapes, draft, undo, clearImage, resetImage, paste, exportCurrent, disabled } = m

  return (
      <header className="image-header">
        <span className="image-brand">
          <ImageIcon />
        </span>
        <div>
          <h1>图片工具箱</h1>
          <p>缩放 · 裁剪 · 旋转 · 压缩 · 转换 · 水印 · 取色 · 锐化 · 合成 · OCR</p>
        </div>
        <div className="image-header-actions">
          <button
            className="image-button"
            disabled={busy}
            onClick={() => fileInput.current?.click()}
          >
            <Upload />
            导入图片
          </button>
          <button
            className="image-button"
            disabled={busy}
            onClick={paste}
          >
            <Clipboard />
            剪贴板
          </button>
          <button
            className="image-button"
            disabled={disabled}
            onClick={clearImage}
          >
            <Trash2 />
            清空
          </button>
          <button
            className="image-button"
            disabled={disabled}
            onClick={resetImage}
          >
            <RotateCcw />
            重置
          </button>
          <button
            className="image-button"
            disabled={busy || (!history.length && !shapes.length && !draft)}
            onClick={undo}
          >
            <Undo2 />
            撤回
          </button>
          <Action
            disabled={disabled}
            onClick={exportCurrent}
          >
            <Download />
            导出
          </Action>
        </div>
      </header>
  )
}
