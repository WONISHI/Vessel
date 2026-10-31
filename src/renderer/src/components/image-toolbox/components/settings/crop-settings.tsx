import { Action } from "@/components/image-toolbox/components/action"
import { NumberField } from "@/components/image-toolbox/components/number-field"
import { Switch } from "@/components/ui/switch"
import { clampRegion, cropImage } from "@vessel/utils/image/operations"
import { fitCrop, photoSizes } from "@vessel/utils/image/photo"
import type { ImageToolboxModel } from "@/components/image-toolbox/hooks/use-image-toolbox"

/** 裁剪设置 */
export function CropSettings({ m }: { m: ImageToolboxModel }) {
  const { image, tool, size, region, setRegion, photoSize, setPhotoSize, standardPhotoOutput, setStandardPhotoOutput, setCropRatio, apply, cropField, disabled } = m

  return (
    <>
                  {tool === "crop" && (
                    <>
                      <p className="image-hint">在图片上拖动框选，或输入裁剪范围。</p>
                      <div className="image-control-row">
                        <NumberField
                          label="X"
                          value={region.x}
                          onChange={(v) => cropField("x", v)}
                        />
                        <NumberField
                          label="Y"
                          value={region.y}
                          onChange={(v) => cropField("y", v)}
                        />
                      </div>
                      <div className="image-control-row">
                        <NumberField
                          label="宽度"
                          min={1}
                          value={region.width}
                          onChange={(v) => cropField("width", v)}
                        />
                        <NumberField
                          label="高度"
                          min={1}
                          value={region.height}
                          onChange={(v) => cropField("height", v)}
                        />
                      </div>
                      <div className="image-presets">
                        {[1, 4 / 3, 16 / 9, 9 / 16].map((ratio, i) => (
                          <button
                            key={ratio}
                            aria-pressed={!photoSize && Math.abs(region.width / region.height - ratio) < 0.02 && (region.width !== size.width || region.height !== size.height)}
                            onClick={() => {
                              setPhotoSize("")
                              setCropRatio(ratio)
                              const w = Math.min(size.width, size.height * ratio),
                                h = w / ratio
                              setRegion(clampRegion({ x: (size.width - w) / 2, y: (size.height - h) / 2, width: w, height: h }, size))
                            }}
                          >
                            {["1:1", "4:3", "16:9", "9:16"][i]}
                          </button>
                        ))}
                      </div>
                      <label className="image-field">
                        证件照尺寸
                        <select
                          aria-label="证件照尺寸"
                          value={photoSize}
                          onChange={(e) => {
                            const value = e.target.value
                            setPhotoSize(value)
                            const preset = photoSizes.find((p) => p.id === value)
                            const ratio = preset ? preset.pixels.width / preset.pixels.height : null
                            setCropRatio(ratio)
                            if (ratio) setRegion(fitCrop(size, ratio))
                          }}
                        >
                          <option value="">自由裁剪 / 自定义比例</option>
                          {photoSizes.map((p) => (
                            <option
                              key={p.id}
                              value={p.id}
                            >
                              {p.label} · {p.width} × {p.height} mm
                            </option>
                          ))}
                        </select>
                      </label>
                      {photoSize && (
                        <>
                          <label className="image-switch">
                            按证件照像素输出
                            <Switch
                              aria-label="按证件照像素输出"
                              checked={standardPhotoOutput}
                              onCheckedChange={setStandardPhotoOutput}
                            />
                          </label>
                          <p className="image-hint">
                            默认保留裁剪区域原始像素，只按证件照比例裁剪。开启后输出 {photoSizes.find((p) => p.id === photoSize)!.pixels.width} × {photoSizes.find((p) => p.id === photoSize)!.pixels.height} px（按 300 PPI
                            换算）。拖动裁剪框调整位置，四角缩放保持比例。缩小会丢失细节，低分辨率原图放大不会增加细节。
                          </p>
                        </>
                      )}
                      <div className="image-control-row">
                        <button
                          className="image-button"
                          onClick={() => {
                            setPhotoSize("")
                            setCropRatio(null)
                            setRegion({ x: 0, y: 0, ...size })
                          }}
                        >
                          重置
                        </button>
                        <Action
                          disabled={disabled}
                          onClick={() => apply(() => cropImage(image, region, standardPhotoOutput ? photoSizes.find((p) => p.id === photoSize)?.pixels : undefined))}
                        >
                          应用裁剪
                        </Action>
                      </div>
                    </>
                  )}
    </>
  )
}
