import { useEffect, useRef, useState } from 'react'
import type { GitStashEntry, GitStashRestoreRecord } from '@vessel/type/git'
import { History, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { GitPageDialog, GitPageDialogContent } from './git-page-dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cleanGitErrorMessage } from '../utils'

export function GitStashHistoryButton({ root, onView }: { root: string; onView: (record: GitStashEntry) => unknown }) {
  const [open, setOpen] = useState(false)
  const [records, setRecords] = useState<GitStashRestoreRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const request = useRef(0)
  useEffect(() => () => { request.current++ }, [root])
  const load = async () => {
    const version = ++request.current
    setOpen(true); setLoading(true); setError('')
    try {
      const next = await window.electronAPI.git.getStashRestoreHistory(root)
      if (version === request.current) setRecords(next)
    } catch (error) { if (version === request.current) setError(cleanGitErrorMessage(error)) }
    finally { if (version === request.current) setLoading(false) }
  }
  return <>
    <button type="button" aria-label="查看贮藏恢复记录" data-title="查看贮藏恢复记录" data-title-side="bottom" disabled={!root} className="grid size-5 place-items-center rounded text-stone-500 hover:bg-stone-200 disabled:opacity-40" onClick={() => void load()}><History className="size-3.5" /></button>
    <GitPageDialog open={open} onOpenChange={value => { setOpen(value); if (!value) request.current++ }}>
      <GitPageDialogContent className="git-dialog flex max-h-[80vh] max-w-2xl flex-col gap-3 p-5">
        <DialogHeader><DialogTitle>贮藏恢复记录</DialogTitle><DialogDescription>记录本机 Vessel 中执行的恢复，保留最近 1000 条；历史命令行操作无法补录。恢复记录不代表当前代码仍包含这些修改。</DialogDescription></DialogHeader>
        <div className="flex items-center justify-between text-xs text-stone-500"><span>{records.length} 条记录 · 最新在上</span><Button size="sm" variant="outline" disabled={loading} onClick={() => void load()}><RefreshCw size={12} />刷新</Button></div>
        {error ? <p role="alert" className="text-xs text-red-600">{error}</p> : loading ? <p role="status" className="p-6 text-center text-xs text-stone-500">正在读取恢复记录…</p> : <ScrollArea type="hover" className="min-h-0 max-h-[55vh] [&_[data-radix-scroll-area-viewport]]:max-h-[55vh]">
          {!records.length && <p className="p-6 text-center text-xs text-stone-400">暂无恢复记录；以后在 Vessel 中恢复贮藏会自动记录。</p>}
          {records.map(record => <article key={record.id} className="mb-2 rounded-lg border border-stone-200 p-3 text-xs dark:border-white/10">
            <div className="flex items-start justify-between gap-3"><span className="min-w-0 break-words font-medium">{record.name}</span><span className={`shrink-0 rounded px-1.5 py-0.5 ${record.outcome === 'conflicts' ? 'bg-amber-50 text-amber-700' : 'bg-green-50 text-green-700'}`}>{record.outcome === 'conflicts' ? '恢复时有冲突' : '已恢复过'}</span></div>
            <p className="mt-2 text-stone-500"><time dateTime={record.at}>{new Date(record.at).toLocaleString('zh-CN', { hour12: false })}</time> · 分支 {record.branch || '游离 HEAD'}</p>
            <p className="mt-1 text-stone-500">{record.action === 'apply' ? '应用并保留' : '弹出贮藏'} · {record.dropped ? '当时已移除贮藏记录' : '当时保留了贮藏记录'}</p>
            <p className="mt-1 break-all font-mono text-[10px] text-stone-400">stash@{'{'}{record.index}{'}'}（恢复时） · {record.hash}</p>
            {!!record.conflicts.length && <p className="mt-1 text-amber-700">恢复时有 {record.conflicts.length} 个冲突文件</p>}
            {record.note && <p className="mt-1 break-words text-amber-700">{record.note}</p>}
            <Button size="sm" variant="outline" className="mt-2 h-6 text-[10px]" onClick={() => { setOpen(false); request.current++; void onView({ index: record.index, name: record.name, hash: record.hash, date: record.stashDate }) }}>查看保存内容</Button>
          </article>)}
        </ScrollArea>}
      </GitPageDialogContent>
    </GitPageDialog>
  </>
}
