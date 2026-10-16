export type { Shape } from "@vessel/type/image-annotation"
export { formatBytes, formatDate } from "@vessel/utils/format/display"
export { arrowHead, drawShape } from "@vessel/utils/image/annotations"
import { Brush, Circle, Crop, Expand, Layers, Minimize2, MoveUpRight, Palette, Pencil, RotateCw, ScanLine, Shield, Sparkles, Square, Type } from "lucide-react"
import { toast } from "sonner"

export const annotateTools = [
  { id: "pen", title: "画笔", icon: Pencil },
  { id: "rect", title: "矩形", icon: Square },
  { id: "ellipse", title: "圆形", icon: Circle },
  { id: "arrow", title: "箭头", icon: MoveUpRight },
  { id: "text", title: "文字", icon: Type }
] as const

export const groups = [
  {
    label: "基础编辑",
    tools: [
      { id: "resize", title: "缩放", icon: Expand },
      { id: "crop", title: "裁剪", icon: Crop },
      { id: "rotate", title: "旋转", icon: RotateCw },
      { id: "annotate", title: "标注", icon: Brush },
      { id: "background", title: "更换背景色", icon: Palette }
    ]
  },
  {
    label: "画质优化",
    tools: [
      { id: "sharpen", title: "锐化", icon: Sparkles },
      { id: "compress", title: "压缩", icon: Minimize2 }
    ]
  },
  { label: "导出转换", tools: [{ id: "convert", title: "格式转换", icon: Type }] },
  {
    label: "高级功能",
    tools: [
      { id: "watermark", title: "加水印", icon: Shield },
      { id: "color", title: "取主色调", icon: Palette },
      { id: "composite", title: "合成", icon: Layers }
    ]
  },
  { label: "文字识别", tools: [{ id: "ocr", title: "OCR 识别", icon: ScanLine }] }
]
export const allTools = groups.flatMap((g) => g.tools)

/** Copies copy. */
export const copy = (value: string) =>
  void navigator.clipboard
    .writeText(value)
    .then(() => toast.success("已复制"))
    .catch((e) => toast.error(String(e)))
