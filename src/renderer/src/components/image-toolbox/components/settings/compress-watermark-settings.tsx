import { Action } from "@/components/image-toolbox/components/action"
import { NumberField } from "@/components/image-toolbox/components/number-field"
import { RangeField } from "@/components/image-toolbox/components/range-field"
import { imageCanvas } from "@vessel/utils/image/operations"
import { Download } from "lucide-react"
import type { ImageToolboxModel } from "@/components/image-toolbox/hooks/use-image-toolbox"

/** 压缩 / 转换与水印设置 */
export function CompressWatermarkSettings({ m }: { m: ImageToolboxModel }) {
  const { image, tool, busy, quality, setQuality, format, setFormat, watermark, setWatermark, fontSize, setFontSize, opacity, setOpacity, ink, setInk, apply, exportCurrent, disabled } = m

  return (
    <>
                  {(tool === "compress" || tool === "convert") && (
                    <>
                      <label className="image-field">
                        导出格式
                        <select
                          value={format}
                          onChange={(e) => setFormat(e.target.value)}
                        >
                          <option value="image/png">PNG（无损）</option>
                          <option value="image/jpeg">JPEG</option>
                          <option value="image/webp">WebP</option>
                        </select>
                      </label>
                      {format !== "image/png" && (
                        <RangeField
                          disabled={busy}
                          label="图片质量 (%)"
                          value={quality}
                          onChange={setQuality}
                        />
                      )}
                      <p className="image-hint">PNG 保留透明度；JPEG 使用白色背景。压缩大小由图片内容和质量决定。</p>
                      <Action
                        disabled={disabled}
                        onClick={exportCurrent}
                      >
                        <Download />
                        导出图片
                      </Action>
                    </>
                  )}
                  {tool === "watermark" && (
                    <>
                      <label className="image-field">
                        水印文字
                        <input
                          value={watermark}
                          onChange={(e) => setWatermark(e.target.value)}
                          maxLength={200}
                        />
                      </label>
                      <NumberField
                        label="字号 (px)"
                        min={1}
                        max={500}
                        value={fontSize}
                        onChange={setFontSize}
                      />
                      <RangeField
                        disabled={busy}
                        label="不透明度 (%)"
                        value={opacity}
                        onChange={setOpacity}
                      />
                      <label className="image-field">
                        文字颜色
                        <input
                          type="color"
                          value={ink}
                          onChange={(e) => setInk(e.target.value)}
                        />
                      </label>
                      <p className="image-hint">文字放置在图片右下角。</p>
                      <Action
                        disabled={disabled || !watermark}
                        onClick={() =>
                          apply(async () => {
                            const canvas = await imageCanvas(image),
                              ctx = canvas.getContext("2d")!
                            ctx.globalAlpha = opacity / 100
                            ctx.fillStyle = ink
                            ctx.font = `${Math.max(1, Math.min(500, fontSize))}px sans-serif`
                            ctx.textAlign = "right"
                            ctx.textBaseline = "bottom"
                            ctx.fillText(watermark, canvas.width - Math.min(24, canvas.width * 0.05), canvas.height - Math.min(24, canvas.height * 0.05), canvas.width * 0.9)
                            return canvas
                          })
                        }
                      >
                        添加水印
                      </Action>
                    </>
                  )}
    </>
  )
}
