import { useEffect, useState } from "react"
import { PdfDocument } from "@/components/pdf-document"
import { useWorkspace } from "@/pages/workspace/hooks/useWorkspace"

export { PdfDocument }

export default function PdfCanvas({ activeFilePath }: { activeFilePath: string }) {
  const { workspace } = useWorkspace()
  const [result, setResult] = useState<{ path: string; bytes?: Uint8Array; error?: string }>()
  useEffect(() => {
    let active = true
    void window.electronAPI
      .readTransitFile(workspace.path, activeFilePath)
      .then((file) => {
        if (active && file.kind === "pdf") setResult({ path: activeFilePath, bytes: file.bytes })
      })
      .catch((error) => {
        if (active) setResult({ path: activeFilePath, error: String(error) })
      })
    return () => {
      active = false
    }
  }, [workspace.path, activeFilePath])
  if (result?.path !== activeFilePath) return <p className="p-4 text-sm">正在读取 PDF…</p>
  if (result.error)
    return (
      <p
        role="alert"
        className="p-4 text-sm text-red-500"
      >
        {result.error}
      </p>
    )
  return result.bytes ? (
    <PdfDocument
      bytes={result.bytes}
      name={activeFilePath.split("/").pop() || "PDF"}
    />
  ) : null
}
