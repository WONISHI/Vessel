import { FileSpreadsheet, FileText, Presentation } from "lucide-react"
export type Doc = { id: string; token?: string; file?: File; newDocument?: "docx" | "xlsx" | "pptx"; name: string; dirty?: boolean; status?: string }

/** Requests host. */
export function requestHost<T>(data: object): Promise<T> {
  return new Promise((resolve, reject) => {
    const channel = new MessageChannel()
    const timeout = setTimeout(() => {
      channel.port1.close()
      reject(new Error("操作超时，请重试"))
    }, 300000)
    channel.port1.onmessage = (event) => {
      clearTimeout(timeout)
      channel.port1.close()
      if (event.data.error) reject(new Error(event.data.error))
      else resolve(event.data.result)
    }
    parent.postMessage(data, "*", [channel.port2])
  })
}
export const kinds = [
  { type: "docx", label: "Word 文档", Icon: FileText, color: "#2563eb" },
  { type: "xlsx", label: "Excel 表格", Icon: FileSpreadsheet, color: "#16a34a" },
  { type: "pptx", label: "PPT 演示文稿", Icon: Presentation, color: "#d97706" }
] as const
export const pdfKind = { type: "pdf", Icon: FileText, color: "#dc2626" } as const

/** Checks whether pdf. */
export const isPdf = (name: string) => /\.pdf$/i.test(name)

export { PdfErrorBoundary } from "@/features/office/components/pdf-error-boundary"
