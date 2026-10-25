import { FileCode2, FileText, LayoutTemplate } from "lucide-react"

/** Shared file templates for the toolbar picker and folder context submenu. */
export const fileEntryOptions = ["md", "markdowntable", "mind", "excalidraw.md", "js", "ts", "json", "jsx", "html", "css", "vue", ""].map((extension) => ({
  extension,
  label: extension === "markdowntable" ? "新建高级表格 (.markdowntable)" : extension === "mind" ? "新建思维导图 (.mind)" : extension === "excalidraw.md" ? "新建白板 (.excalidraw.md)" : extension ? `新建 ${extension.toUpperCase()} 文件` : "新建自定义文件",
  icon: extension === "md" ? FileText : extension === "excalidraw.md" ? LayoutTemplate : FileCode2
}))
