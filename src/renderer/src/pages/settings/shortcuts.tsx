import { Fragment } from 'react'
import { ChevronDown } from 'lucide-react'
import { shortcuts, screenshotShortcut, shortcutLabel, type ShortcutId } from '../../../../shared/shortcuts'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { Kbd, KbdGroup } from '@/components/ui/kbd'

const categories = ['全局与导航', '浏览器', '编辑器', 'Markdown', '截图']
function category(id: ShortcutId) {
  const scope = shortcuts[id].scope as string
  if (scope === 'Markdown 编辑器') return 'Markdown'
  if (scope.startsWith('截图')) return '截图'
  if (scope === '浏览器') return '浏览器'
  if (['save', 'undo', 'redo', 'goToLine'].includes(id)) return '编辑器'
  return '全局与导航'
}
function Keys({ value }: { value: string }) {
  return <KbdGroup aria-label={value}>{value.split(/\s*\+\s*/).map((key, index) => <Fragment key={`${index}:${key}`}>{index > 0 && <span aria-hidden className="text-[10px] text-stone-400">+</span>}<Kbd>{key}</Kbd></Fragment>)}</KbdGroup>
}
export function ShortcutSettings() {
  const mac = navigator.platform.includes('Mac')
  const rows: { id: string; group: string; title: string; scope: string; keys: string }[] = (Object.keys(shortcuts) as ShortcutId[]).map(id => ({ id, group: category(id), title: shortcuts[id].label, scope: shortcuts[id].scope, keys: shortcutLabel(id, mac) }))
  rows.unshift({ id: 'screenshot', group: '截图', title: screenshotShortcut.label, scope: screenshotShortcut.scope, keys: mac ? screenshotShortcut.mac : screenshotShortcut.windows })
  return <><h2>快捷键</h2><p className="settings-description">按使用场景分组，编辑操作在对应编辑器中生效。滚动快捷键优先作用于鼠标悬停的内容区域。</p>
    <div className="space-y-3">{categories.map(group => {
      const entries = rows.filter(row => row.group === group)
      return <Collapsible key={group} defaultOpen className="overflow-hidden rounded-xl border bg-white">
        <CollapsibleTrigger className="group flex w-full items-center gap-2 bg-stone-50/70 px-4 py-2.5 text-left text-xs font-semibold text-stone-700 hover:bg-stone-100"><ChevronDown className="size-3.5 transition-transform group-data-[state=closed]:-rotate-90" />{group}<span className="ml-auto text-[11px] font-normal text-stone-400">{entries.length}</span></CollapsibleTrigger>
        <CollapsibleContent><div className="divide-y divide-stone-100">{entries.map(row => <div key={row.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-4 py-2.5"><div className="min-w-0"><div className="text-xs font-medium text-stone-800">{row.title}</div><p className="mt-1 text-[11px] text-stone-400">{row.scope}</p></div><Keys value={row.keys} /></div>)}</div></CollapsibleContent>
      </Collapsible>
    })}</div></>
}
