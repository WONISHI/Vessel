import { Action } from "@/components/image-toolbox/components/action"
import { RangeField } from "@/components/image-toolbox/components/range-field"
import { Switch } from "@/components/ui/switch"
import { imageCanvas } from "@vessel/utils/image/operations"
import type { ImageToolboxModel } from "@/components/image-toolbox/hooks/use-image-toolbox"

/** 背景处理与锐化设置 */
export function BackgroundSharpenSettings({ m }: { m: ImageToolboxModel }) {
  const { backgroundEdit, image, tool, setMattingProgress, busy, backgroundColor, setBackgroundColor, portraitFeather, setPortraitFeather, shadowCleanup, setShadowCleanup, portraitDecontaminate, setPortraitDecontaminate, strength, setStrength, run, accept, apply, disabled } = m

  return (
    <>
                  {tool === "background" && (
                    <>
                      <label className="image-field">
                        目标背景色
                        <input
                          type="color"
                          value={backgroundColor}
                          onChange={(e) => setBackgroundColor(e.target.value)}
                        />
                      </label>
                      <div className="image-presets">
                        {[
                          ["白色", "#ffffff"],
                          ["蓝色", "#438edb"],
                          ["红色", "#d93025"]
                        ].map(([name, color]) => (
                          <button
                            key={color}
                            aria-pressed={backgroundColor === color}
                            onClick={() => setBackgroundColor(color)}
                          >
                            <span style={{ display: "inline-block", width: 12, height: 12, background: color, border: "1px solid #ddd", marginRight: 6 }} />
                            {name}
                          </button>
                        ))}
                      </div>
                      <RangeField
                        disabled={busy}
                        label="主体边缘羽化 (px)"
                        value={portraitFeather}
                        onChange={setPortraitFeather}
                        max={6}
                      />
                      <RangeField
                        disabled={busy}
                        label="边缘阴影清理"
                        value={shadowCleanup}
                        onChange={setShadowCleanup}
                      />
                      <label className="image-switch">
                        去除主体边缘残色
                        <Switch
                          disabled={busy}
                          aria-label="去除主体边缘残色"
                          checked={portraitDecontaminate}
                          onCheckedChange={setPortraitDecontaminate}
                        />
                      </label>
                      <p className="image-hint">自动识别图片主体并替换背景，全程离线。羽化默认 6 px；阴影清理可减轻轮廓外的灰红色残影，过高可能减少细发丝。重复应用会基于换底前的图片处理，避免边缘越改越模糊。</p>
                      <Action
                        disabled={disabled}
                        onClick={() => {
                          void run(async () => {
                            try {
                              setMattingProgress("正在处理背景…")
                              const { portraitBackground } = await import("@/lib/image/portrait-matting")
                              const source = backgroundEdit.current?.result === image ? backgroundEdit.current.source : image
                              const canvas = await portraitBackground(source, backgroundColor, setMattingProgress, { feather: portraitFeather, decontaminate: portraitDecontaminate, shadowCleanup })
                              const result = canvas.toDataURL("image/png")
                              await accept(result)
                              backgroundEdit.current = { source, result }
                            } finally {
                              setMattingProgress("")
                            }
                          })
                        }}
                      >
                        应用背景色
                      </Action>
                    </>
                  )}
                  {tool === "sharpen" && (
                    <>
                      <RangeField
                        disabled={busy}
                        label="锐化强度"
                        value={strength}
                        onChange={setStrength}
                      />
                      <Action
                        disabled={disabled}
                        onClick={() =>
                          apply(async () => {
                            const canvas = await imageCanvas(image),
                              ctx = canvas.getContext("2d")!,
                              data = ctx.getImageData(0, 0, canvas.width, canvas.height),
                              original = new Uint8ClampedArray(data.data),
                              w = canvas.width,
                              h = canvas.height,
                              amount = strength / 100
                            for (let y = 1; y < h - 1; y++)
                              for (let x = 1; x < w - 1; x++)
                                for (let c = 0; c < 3; c++) {
                                  const i = (y * w + x) * 4 + c
                                  data.data[i] = original[i] + amount * (4 * original[i] - original[i - 4] - original[i + 4] - original[i - w * 4] - original[i + w * 4])
                                }
                            ctx.putImageData(data, 0, 0)
                            return canvas
                          })
                        }
                      >
                        应用锐化
                      </Action>
                    </>
                  )}
    </>
  )
}
