import { PdfDocument } from "@/components/pdf-document"
import { Doc, PdfErrorBoundary } from "@/features/office/components/office-components-shared"
import { useEffect, useState } from "react"

/** Renders the pdf pane component. */
export function PdfPane({ doc, hidden }: { doc: Doc; hidden: boolean }) {
  const [bytes, setBytes] = useState<Uint8Array>()
  const [error, setError] = useState("")
  useEffect(() => {
    void doc.file?.arrayBuffer().then(
      (buffer) => setBytes(new Uint8Array(buffer)),
      (reason) => setError(String(reason))
    )
  }, [doc.file])
  return (
    <div
      hidden={hidden}
      style={hidden ? { display: "none" } : undefined}
      className="absolute inset-0 flex bg-white"
    >
      {bytes ? (
        <PdfErrorBoundary>
          <PdfDocument
            bytes={bytes}
            name={doc.name}
          />
        </PdfErrorBoundary>
      ) : (
        <p
          role={error ? "alert" : undefined}
          className={`p-4 text-sm ${error ? "text-red-500" : "text-stone-500"}`}
        >
          {error || "正在读取 PDF…"}
        </p>
      )}
    </div>
  )
}
