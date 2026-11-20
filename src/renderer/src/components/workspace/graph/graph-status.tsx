import { useContext } from 'react'
import { createPortal } from 'react-dom'
import { StatusTarget } from '@/components/workspace/components/layout-main/status-context'
import { useStatusBarVisible } from '@/features/status-bar/visibility'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { ScrollArea } from '@/components/ui/scroll-area'
import type { WorkspaceGraph } from '@vessel/workspace'

/** Index statistics share the workspace status bar instead of adding a second footer. */
export function GraphStatus({ graph }: { graph?: WorkspaceGraph }) {
  const target = useContext(StatusTarget)
  const visible = useStatusBarVisible()
  if (!target || !visible) return null
  const text = graph ? `${graph.stats.files.toLocaleString()} 个文件 · 重新解析 ${graph.stats.scanned.toLocaleString()} · 缓存复用 ${graph.stats.reused.toLocaleString()} · ${(graph.stats.elapsedMs / 1000).toFixed(2)} 秒` : '仅索引当前工作区，忽略隐藏、依赖及构建目录'
  return createPortal(<div className="flex min-w-0 items-center gap-3 px-2 text-[11px]">
    <span className="truncate" data-title={text}>{text}</span>
    {!!graph?.warnings.length && <Popover><PopoverTrigger asChild><button type="button" className="shrink-0 text-amber-600">{graph.warnings.length} 项未完成索引</button></PopoverTrigger><PopoverContent side="top" align="end" className="w-[min(600px,80vw)] p-0"><ScrollArea className="max-h-56 [&_[data-radix-scroll-area-viewport]]:max-h-56"><pre className="whitespace-pre-wrap break-words p-3 text-xs">{graph.warnings.slice(0, 100).join('\n')}</pre></ScrollArea></PopoverContent></Popover>}
  </div>, target)
}
