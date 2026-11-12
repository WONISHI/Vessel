import { CaseSensitive, Binary, Code, Languages, Link, Palette } from "lucide-react"
export const groups = [
  {
    title: "图像",
    items: [
      { id: "json", title: "JSON 格式化", icon: Code },
      { id: "color", title: "颜色转换", icon: Palette }
    ]
  },
  {
    title: "编码",
    items: [
      { id: "case-convert", title: "转写工具", icon: CaseSensitive },
      { id: "base64", title: "Base64", icon: Binary },
      { id: "url", title: "URL 编解码", icon: Link },
      { id: "translate", title: "翻译", icon: Languages }
    ]
  }
]
