import { useEffect, useRef, useState } from 'react'
import { useWorkspace } from '@/pages/workspace/hooks/useWorkspace'

export function PdfDocument({ bytes, name }: { bytes: Uint8Array; name: string }) {
  const frame = useRef<HTMLIFrameElement>(null)
  useEffect(() => {
    const url = URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type: 'application/pdf' }))
    if (frame.current) frame.current.src = url
    return () => URL.revokeObjectURL(url)
  }, [bytes])
  return <iframe ref={frame} title={name} className="h-full min-h-0 w-full flex-1 border-0" />
}

export default function PdfCanvas({ activeFilePath }: { activeFilePath: string }) {
  const { workspace } = useWorkspace()
  const [result, setResult] = useState<{ path: string; bytes?: Uint8Array; error?: string }>()
  useEffect(() => {
    let active = true
    void window.electronAPI.readTransitFile(workspace.path, activeFilePath).then(file => {
      if (active && file.kind === 'pdf') setResult({ path: activeFilePath, bytes: file.bytes })
    }).catch(error => {
      if (active) setResult({ path: activeFilePath, error: String(error) })
    })
    return () => { active = false }
  }, [workspace.path, activeFilePath])
  if (result?.path !== activeFilePath) return <p className="p-4 text-sm">正在读取 PDF…</p>
  if (result.error) return <p role="alert" className="p-4 text-sm text-red-500">{result.error}</p>
  return result.bytes ? <PdfDocument bytes={result.bytes} name={activeFilePath.split('/').pop() || 'PDF'} /> : null
}
