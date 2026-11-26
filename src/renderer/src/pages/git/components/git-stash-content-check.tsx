import { useEffect, useRef, useState } from 'react'
import type { GitStashContentCheck } from '@vessel/type/git'
import { ScanSearch } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cleanGitErrorMessage } from '../utils'

const labels = { same: '内容一致', different: '内容不同', missing: '当前不存在', unknown: '需手动核对' }
export function GitStashContentCheckPanel({ root, hash }: { root: string; hash?: string }) {
  const [result, setResult] = useState<GitStashContentCheck | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const version = useRef(0)
  useEffect(() => () => { version.current++ }, [])
  const check = async () => {
    if (!hash) return
    const request = ++version.current
    setLoading(true); setError(''); setResult(null)
    try {
      const result = await window.electronAPI.git.checkStashContent(root, hash)
      if (request === version.current) setResult(result)
    } catch (error) { if (request === version.current) setError(cleanGitErrorMessage(error)) }
    finally { if (request === version.current) setLoading(false) }
  }
  const same = result?.files.filter(file => file.state === 'same').length || 0
  return <section aria-label="贮藏内容核对" className="shrink-0 border-b border-stone-200 px-3 py-2 text-[11px]">
    <div className="flex flex-wrap items-center gap-2"><Button size="sm" variant="outline" className="h-7 text-[11px]" disabled={!root || !hash || loading} onClick={() => void check()}><ScanSearch size={13} />{loading ? '正在核对…' : result ? '重新核对当前内容' : '核对当前内容'}</Button><span className="text-stone-500">只读比较，不会恢复或删除贮藏。</span></div>
    {error && <p role="alert" className="mt-2 text-red-600">{error}</p>}
    {result && <details open className="mt-2">
      <summary className="cursor-pointer text-stone-600">{same}/{result.files.length} 项内容一致 · 核对于 {new Date(result.checkedAt).toLocaleTimeString('zh-CN', { hour12: false })}</summary>
      <p className="my-2 text-stone-500">内容一致不代表曾执行过恢复；内容不同也可能来自后续修改。</p>
      <ScrollArea type="hover" className="max-h-36 [&_[data-radix-scroll-area-viewport]]:max-h-36">
        {result.files.map(file => <div key={file.path} className="flex min-w-0 items-start justify-between gap-3 py-1"><span className="min-w-0 break-all" data-title={file.reason} data-title-side="bottom">{file.path}</span><span className={`shrink-0 ${file.state === 'same' ? 'text-green-700' : 'text-amber-700'}`}>{labels[file.state]}</span></div>)}
        {!result.files.length && <p className="py-2 text-stone-500">没有可核对的文件变更</p>}
      </ScrollArea>
    </details>}
  </section>
}
