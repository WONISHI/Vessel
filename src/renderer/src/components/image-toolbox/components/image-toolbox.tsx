import { StatusBar } from "@/components/ui/status-bar"
import { Action } from "@/components/image-toolbox/components/action"
import { copy, formatBytes } from "@/components/image-toolbox/components/image-toolbox-shared"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Expand, ImageIcon, Upload, ZoomIn } from "lucide-react"
import type { ImageToolboxProps } from "@/components/image-toolbox/types"
import { useImageToolbox } from "@/components/image-toolbox/hooks/use-image-toolbox"
import { ImageToolboxHeader } from "@/components/image-toolbox/components/image-toolbox-header"
import { ImageToolNav } from "@/components/image-toolbox/components/image-tool-nav"
import { ImagePreview } from "@/components/image-toolbox/components/image-preview"
import { OcrResizeSettings } from "@/components/image-toolbox/components/settings/ocr-resize-settings"
import { CropSettings } from "@/components/image-toolbox/components/settings/crop-settings"
import { RotateAnnotateSettings } from "@/components/image-toolbox/components/settings/rotate-annotate-settings"
import { BackgroundSharpenSettings } from "@/components/image-toolbox/components/settings/background-sharpen-settings"
import { CompressWatermarkSettings } from "@/components/image-toolbox/components/settings/compress-watermark-settings"
import { ColorCompositeSettings } from "@/components/image-toolbox/components/settings/color-composite-settings"

/** Renders the image toolbox component. */
export function ImageToolbox({ initialImage, initialTool = "ocr", embedded = false, navigationOpen, onNavigationChange }: ImageToolboxProps = {}) {
  const m = useImageToolbox({ initialImage, initialTool, navigationOpen, onNavigationChange })
  const { nav, image, tool, meta, size, region, busy, result, setResult, setElapsed, settings, fileInput, layerInput, root, scale, selection, active, Icon, run, readFile } = m

  return (
    <div
      className={"image-toolbox" + (embedded ? " embedded" : "")}
      ref={root}
      aria-busy={busy}
    >
      <ImageToolboxHeader m={m} />
      {[false, true].map((isLayer) => (
        <input
          key={String(isLayer)}
          ref={isLayer ? layerInput : fileInput}
          hidden
          type="file"
          accept="image/png,image/jpeg,image/webp"
          aria-label={isLayer ? "添加合成图片" : "导入图片文件"}
          onChange={(e) => {
            const file = e.target.files?.[0]
            e.target.value = ""
            if (file) void run(() => readFile(file, isLayer))
          }}
        />
      ))}
      <div className="image-body">
        {nav && (
          <ImageToolNav m={m} />
        )}
        <ImagePreview m={m} />
        {settings && (
          <aside className="image-settings">
            <div className="image-settings-heading">
              <span>
                <Icon />
              </span>
              <div>
                <h2>{active.title}</h2>
                <p>{tool === "ocr" ? "图片文字提取，本地离线识别" : "调整参数后应用到图片"}</p>
              </div>
            </div>
            <ScrollArea className="image-settings-scroll">
              <div className="image-settings-content">
                <fieldset disabled={busy}>
                  <OcrResizeSettings m={m} />
                  <CropSettings m={m} />
                  <RotateAnnotateSettings m={m} />
                  <BackgroundSharpenSettings m={m} />
                  <CompressWatermarkSettings m={m} />
                  <ColorCompositeSettings m={m} />
                </fieldset>
              </div>
            </ScrollArea>
            {tool === "ocr" && (
              <footer className="image-settings-footer">
                <button
                  className="image-button"
                  disabled={busy || !result}
                  onClick={() => {
                    setResult("")
                    setElapsed(0)
                  }}
                >
                  清空
                </button>
                <Action
                  disabled={!result}
                  onClick={() => copy(result)}
                >
                  复制全部
                </Action>
              </footer>
            )}
          </aside>
        )}
      </div>
      <StatusBar
        className="image-toolbox-statusbar"
        left={
          image ? (
            <>
              <span
                className="image-status-item image-status-filename"
                data-title={meta.name}
              >
                <ImageIcon />
                <span>{meta.name}</span>
              </span>
              <span
                className="image-status-divider"
                aria-hidden="true"
              />
              <span className="image-status-item">
                <Expand />
                {size.width} × {size.height} px
              </span>
              <span className="image-status-item">
                <ZoomIn />
                {Math.round(scale * 100)}%
              </span>
              <span className="image-status-item">
                <Upload />
                {formatBytes(meta.size)}
              </span>
              {selection && (
                <span className="image-status-item image-status-selection">
                  框选: {region.width} × {region.height} px
                </span>
              )}
            </>
          ) : (
            <span className="image-status-item">
              <ImageIcon />
              未导入图片
            </span>
          )
        }
      />
    </div>
  )
}
