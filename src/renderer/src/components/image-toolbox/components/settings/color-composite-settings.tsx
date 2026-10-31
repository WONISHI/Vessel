import { Action } from "@/components/image-toolbox/components/action"
import { copy } from "@/components/image-toolbox/components/image-toolbox-shared"
import { NumberField } from "@/components/image-toolbox/components/number-field"
import { RangeField } from "@/components/image-toolbox/components/range-field"
import { canvasFor, imageCanvas, loadImage } from "@vessel/utils/image/operations"
import { Copy, Upload } from "lucide-react"
import type { ImageToolboxModel } from "@/components/image-toolbox/hooks/use-image-toolbox"

/** 取色与合成设置 */
export function ColorCompositeSettings({ m }: { m: ImageToolboxModel }) {
  const { image, tool, busy, opacity, setOpacity, colors, setColors, layer, layerX, setLayerX, layerY, setLayerY, layerWidth, setLayerWidth, blend, setBlend, layerInput, run, apply, disabled } = m

  return (
    <>
                  {tool === "color" && (
                    <>
                      <Action
                        disabled={disabled}
                        onClick={() =>
                          void run(async () => {
                            const img = await loadImage(image),
                              canvas = canvasFor(128, 128),
                              ctx = canvas.getContext("2d")!
                            ctx.drawImage(img, 0, 0, 128, 128)
                            const { data } = ctx.getImageData(0, 0, 128, 128),
                              counts = new Map<string, number>()
                            for (let i = 0; i < data.length; i += 4) {
                              if (data[i + 3] < 128) continue
                              const hex =
                                "#" +
                                [data[i], data[i + 1], data[i + 2]]
                                  .map((v) =>
                                    Math.min(255, Math.round(v / 32) * 32)
                                      .toString(16)
                                      .padStart(2, "0")
                                  )
                                  .join("")
                              counts.set(hex, (counts.get(hex) || 0) + 1)
                            }
                            setColors(
                              [...counts]
                                .sort((a, b) => b[1] - a[1])
                                .slice(0, 6)
                                .map(([hex]) => hex)
                            )
                          })
                        }
                      >
                        提取主色调
                      </Action>
                      <div className="image-swatches">
                        {colors.map((color) => (
                          <button
                            key={color}
                            onClick={() => copy(color)}
                          >
                            <span style={{ background: color }} />
                            {color}
                          </button>
                        ))}
                      </div>
                      {!!colors.length && (
                        <button
                          className="image-button"
                          onClick={() => copy(colors.map((c, i) => `--image-color-${i + 1}: ${c};`).join("\n"))}
                        >
                          <Copy />
                          复制 CSS 变量
                        </button>
                      )}
                    </>
                  )}
                  {tool === "composite" && (
                    <>
                      <button
                        className="image-button"
                        disabled={disabled}
                        onClick={() => layerInput.current?.click()}
                      >
                        <Upload />
                        添加图片图层
                      </button>
                      {layer && (
                        <img
                          src={layer}
                          alt="待合成图层"
                          className="image-layer-thumbnail"
                        />
                      )}
                      <div className="image-control-row">
                        <NumberField
                          label="X"
                          min={-8192}
                          value={layerX}
                          onChange={setLayerX}
                        />
                        <NumberField
                          label="Y"
                          min={-8192}
                          value={layerY}
                          onChange={setLayerY}
                        />
                      </div>
                      <NumberField
                        label="图层宽度 (px)"
                        min={1}
                        value={layerWidth}
                        onChange={setLayerWidth}
                      />
                      <RangeField
                        disabled={busy}
                        label="不透明度 (%)"
                        value={opacity}
                        onChange={setOpacity}
                      />
                      <label className="image-field">
                        混合模式
                        <select
                          value={blend}
                          onChange={(e) => setBlend(e.target.value as GlobalCompositeOperation)}
                        >
                          <option value="source-over">正常</option>
                          <option value="multiply">正片叠底</option>
                          <option value="screen">滤色</option>
                          <option value="overlay">叠加</option>
                        </select>
                      </label>
                      <Action
                        disabled={disabled || !layer}
                        onClick={() =>
                          apply(async () => {
                            const canvas = await imageCanvas(image),
                              img = await loadImage(layer),
                              ctx = canvas.getContext("2d")!
                            if (layerWidth < 1 || layerWidth > 8192) throw new Error("图层宽度须在 1–8192 像素内")
                            ctx.globalAlpha = opacity / 100
                            ctx.globalCompositeOperation = blend
                            ctx.drawImage(img, layerX, layerY, layerWidth, (layerWidth * img.naturalHeight) / img.naturalWidth)
                            return canvas
                          })
                        }
                      >
                        合并图层
                      </Action>
                    </>
                  )}
    </>
  )
}
