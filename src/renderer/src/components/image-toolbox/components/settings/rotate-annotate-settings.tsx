import { Action } from "@/components/image-toolbox/components/action"
import { annotateTools } from "@/components/image-toolbox/components/image-toolbox-shared"
import { NumberField } from "@/components/image-toolbox/components/number-field"
import { Trash2, Undo2 } from "lucide-react"
import type { ImageToolboxModel } from "@/components/image-toolbox/hooks/use-image-toolbox"

/** 旋转与标注设置 */
export function RotateAnnotateSettings({ m }: { m: ImageToolboxModel }) {
  const { tool, angle, setAngle, shapes, setShapes, pen, setPen, penColor, setPenColor, penWidth, setPenWidth, note, setNote, noteSize, setNoteSize, rotate, applyShapes, disabled } = m

  return (
    <>
                  {tool === "rotate" && (
                    <>
                      <div className="image-presets">
                        <button
                          disabled={disabled}
                          onClick={() => rotate(-90)}
                        >
                          左转 90°
                        </button>
                        <button
                          disabled={disabled}
                          onClick={() => rotate(90)}
                        >
                          右转 90°
                        </button>
                        <button
                          disabled={disabled}
                          onClick={() => rotate(0, "x")}
                        >
                          水平翻转
                        </button>
                        <button
                          disabled={disabled}
                          onClick={() => rotate(0, "y")}
                        >
                          垂直翻转
                        </button>
                      </div>
                      <NumberField
                        label="旋转角度"
                        min={-360}
                        max={360}
                        value={angle}
                        onChange={setAngle}
                      />
                      <Action
                        disabled={disabled}
                        onClick={() => rotate(angle)}
                      >
                        应用旋转
                      </Action>
                    </>
                  )}
                  {tool === "annotate" && (
                    <>
                      <p className="image-hint">选择工具后在图片上拖动绘制；文字工具点击图片放置。</p>
                      <div className="image-presets">
                        {annotateTools.map(({ id, title, icon: PenIcon }) => (
                          <button
                            key={id}
                            aria-pressed={pen === id}
                            onClick={() => setPen(id)}
                          >
                            <PenIcon />
                            {title}
                          </button>
                        ))}
                      </div>
                      <label className="image-field">
                        颜色
                        <input
                          type="color"
                          value={penColor}
                          onChange={(e) => setPenColor(e.target.value)}
                        />
                      </label>
                      <NumberField
                        label="线宽 (px)"
                        min={1}
                        max={100}
                        value={penWidth}
                        onChange={setPenWidth}
                      />
                      {pen === "text" && (
                        <>
                          <label className="image-field">
                            文字内容
                            <input
                              value={note}
                              onChange={(e) => setNote(e.target.value)}
                              maxLength={200}
                            />
                          </label>
                          <NumberField
                            label="字号 (px)"
                            min={8}
                            max={500}
                            value={noteSize}
                            onChange={setNoteSize}
                          />
                        </>
                      )}
                      <div className="image-control-row">
                        <button
                          className="image-button"
                          disabled={!shapes.length}
                          onClick={() => setShapes((list) => list.slice(0, -1))}
                        >
                          <Undo2 />
                          撤销一笔
                        </button>
                        <button
                          className="image-button"
                          disabled={!shapes.length}
                          onClick={() => setShapes([])}
                        >
                          <Trash2 />
                          清空
                        </button>
                      </div>
                      <Action
                        disabled={disabled || !shapes.length}
                        onClick={applyShapes}
                      >
                        应用标注
                      </Action>
                    </>
                  )}
    </>
  )
}
