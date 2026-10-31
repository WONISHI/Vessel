import { Action } from "@/components/image-toolbox/components/action"
import { copy } from "@/components/image-toolbox/components/image-toolbox-shared"
import { NumberField } from "@/components/image-toolbox/components/number-field"
import { Switch } from "@/components/ui/switch"
import { canvasFor, downloadText, loadImage } from "@vessel/utils/image/operations"
import { Copy, Download, Sparkles } from "lucide-react"
import type { ImageToolboxModel } from "@/components/image-toolbox/hooks/use-image-toolbox"

/** OCR 与缩放设置 */
export function OcrResizeSettings({ m }: { m: ImageToolboxModel }) {
  const { image, tool, size, resize, setResize, regionOCR, setRegionOCR, result, setResult, elapsed, locked, setLocked, apply, recognize, resizeField, disabled } = m

  return (
    <>
                  {tool === "ocr" && (
                    <>
                      <div className="image-control-row">
                        <span className="image-language">中文 + 英文</span>
                        <Action
                          disabled={disabled}
                          onClick={recognize}
                        >
                          <Sparkles />
                          开始识别
                        </Action>
                      </div>
                      <label className="image-switch">
                        框选区域识别
                        <Switch
                          checked={regionOCR}
                          onCheckedChange={setRegionOCR}
                        />
                      </label>
                      <div className="image-result-label">
                        识别结果
                        <div>
                          <button
                            aria-label="复制识别文字"
                            disabled={!result}
                            onClick={() => copy(result)}
                          >
                            <Copy />
                          </button>
                          <button
                            aria-label="下载识别文字"
                            disabled={!result}
                            onClick={() => downloadText(result, "ocr-result.txt")}
                          >
                            <Download />
                          </button>
                        </div>
                      </div>
                      <textarea
                        aria-label="识别结果"
                        value={result}
                        onChange={(e) => setResult(e.target.value)}
                        placeholder="点击开始识别，结果将显示在这里"
                        className="image-result"
                      />
                      <div className="image-result-stats">
                        {result ? result.split("\n").length : 0} 行 · {result.length} 字 <span>耗时 {elapsed.toFixed(1)}s</span> · 本地离线
                      </div>
                    </>
                  )}
                  {tool === "resize" && (
                    <>
                      <div className="image-control-row">
                        <NumberField
                          label="宽度 (px)"
                          min={1}
                          value={resize.width}
                          onChange={(v) => resizeField("width", v)}
                        />
                        <NumberField
                          label="高度 (px)"
                          min={1}
                          value={resize.height}
                          onChange={(v) => resizeField("height", v)}
                        />
                      </div>
                      <label className="image-switch">
                        锁定比例
                        <Switch
                          checked={locked}
                          onCheckedChange={setLocked}
                        />
                      </label>
                      <div className="image-presets">
                        {[25, 50, 75, 100, 200].map((v) => (
                          <button
                            key={v}
                            aria-pressed={resize.width === Math.round((size.width * v) / 100) && resize.height === Math.round((size.height * v) / 100)}
                            onClick={() => setResize({ width: Math.round((size.width * v) / 100), height: Math.round((size.height * v) / 100) })}
                          >
                            {v}%
                          </button>
                        ))}
                      </div>
                      <Action
                        disabled={disabled}
                        onClick={() =>
                          apply(async () => {
                            const img = await loadImage(image),
                              canvas = canvasFor(resize.width, resize.height),
                              ctx = canvas.getContext("2d")!
                            ctx.imageSmoothingQuality = "high"
                            ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
                            return canvas
                          })
                        }
                      >
                        应用缩放
                      </Action>
                    </>
                  )}
    </>
  )
}
