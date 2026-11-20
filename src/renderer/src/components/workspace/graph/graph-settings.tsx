import { ChevronRight, Plus, RotateCcw, X } from 'lucide-react'
import type { ReactNode } from 'react'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Slider } from '@/components/ui/slider'
import { defaultGraphSettings, type GraphSettings as Settings } from '@vessel/workspace'

function Section({ title, open = false, children }: { title: string; open?: boolean; children: ReactNode }) {
  return <Collapsible defaultOpen={open} className="workspace-graph-section">
    <CollapsibleTrigger className="workspace-graph-section-trigger"><ChevronRight size={13} /><span>{title}</span></CollapsibleTrigger>
    <CollapsibleContent><div className="workspace-graph-section-content">{children}</div></CollapsibleContent>
  </Collapsible>
}
function CheckSetting({ label, checked, onChange }: { label: string; checked: boolean; onChange: (value: boolean) => void }) {
  return <label className="workspace-graph-check"><span>{label}</span><Checkbox aria-label={label} checked={checked} onCheckedChange={(value) => onChange(value === true)} className="!border-stone-300 data-[state=checked]:!border-emerald-600 data-[state=checked]:!bg-emerald-600 data-[state=checked]:!text-white" /></label>
}
function RangeSetting({ label, value, min, max, step, onChange }: { label: string; value: number; min: number; max: number; step: number; onChange: (value: number) => void }) {
  return <div className="workspace-graph-range"><div className="flex items-center justify-between"><span>{label}</span><output className="workspace-graph-muted tabular-nums">{value}</output></div><Slider aria-label={label} value={[value]} min={min} max={max} step={step} onValueChange={([next]) => onChange(next)} /></div>
}
export function GraphSettings({ settings, onChange, activeLabel }: { settings: Settings; onChange: (value: Settings) => void; activeLabel: string }) {
  const set = <K extends keyof Settings>(key: K, value: Settings[K]) => onChange({ ...settings, [key]: value })
  return <aside className="workspace-graph-settings" aria-label="图谱设置">
    <ScrollArea className="workspace-graph-settings-scroll" type="hover" scrollHideDelay={300}>
    <div className="workspace-graph-settings-content">
      <div className="workspace-graph-settings-heading"><strong>图谱设置</strong><button type="button" aria-label="恢复默认图谱设置" data-title="恢复默认" onClick={() => onChange({ ...defaultGraphSettings, groups: [] })}><RotateCcw size={14} /></button></div>
      <Section title="筛选" open>
        <Input aria-label="搜索图谱" placeholder="搜索、path:目录、tag:标签" value={settings.query} onChange={(event) => set('query', event.target.value)} className="h-8 text-xs md:text-xs" />
        <p className="workspace-graph-muted">支持 file:、path:、tag:、引号和 -排除</p>
        {([['tags', '标签'], ['attachments', '附件'], ['existingOnly', '仅显示已有文件'], ['orphans', '孤立节点'], ['local', '局部图谱']] as const).map(([key, label]) => <CheckSetting key={key} label={label} checked={settings[key]} onChange={(value) => set(key, value)} />)}
        {settings.local && <><p className="workspace-graph-muted">中心：{activeLabel || '请先打开文件，或右键节点选择局部图谱'}</p><RangeSetting label="局部图谱深度" value={settings.depth} min={1} max={5} step={1} onChange={(value) => set('depth', value)} />{([['incoming', '入链'], ['outgoing', '出链']] as const).map(([key, label]) => <CheckSetting key={key} label={label} checked={settings[key]} onChange={(value) => set(key, value)} />)}</>}
      </Section>
      <Section title="颜色分组" open>
        {settings.groups.map((group, index) => <div className="workspace-graph-group" key={index}><input aria-label={`分组 ${index + 1} 颜色`} type="color" value={group.color} onChange={(event) => set('groups', settings.groups.map((value, i) => i === index ? { ...value, color: event.target.value } : value))} /><Input aria-label={`分组 ${index + 1} 查询`} placeholder="path:项目 或 tag:主题" value={group.query} onChange={(event) => set('groups', settings.groups.map((value, i) => i === index ? { ...value, query: event.target.value } : value))} className="h-7 text-xs md:text-xs" /><button type="button" aria-label={`删除分组 ${index + 1}`} onClick={() => set('groups', settings.groups.filter((_, i) => i !== index))}><X size={12} /></button></div>)}
        <button type="button" className="workspace-graph-add-group" onClick={() => set('groups', [...settings.groups, { query: '', color: ['#10b981', '#f59e0b', '#8b5cf6', '#3b82f6', '#ec4899'][settings.groups.length % 5] }])}><Plus size={13} />新建分组</button>
      </Section>
      <Section title="显示">
        <CheckSetting label="连线方向箭头" checked={settings.arrows} onChange={(value) => set('arrows', value)} />
        {([['labels', '文字显示', 0, 3, 0.1], ['nodeSize', '节点大小', 0.3, 3, 0.1], ['lineWidth', '连线粗细', 0.2, 4, 0.1]] as const).map(([key, label, min, max, step]) => <RangeSetting key={key} label={label} value={settings[key]} min={min} max={max} step={step} onChange={(value) => set(key, value)} />)}
      </Section>
      <Section title="作用力">
        {([['center', '中心力', 0, 0.02, 0.0005], ['repel', '排斥力', 0, 3000, 50], ['linkForce', '连接力', 0, 0.2, 0.005], ['linkDistance', '连线距离', 20, 300, 5]] as const).map(([key, label, min, max, step]) => <RangeSetting key={key} label={label} value={settings[key]} min={min} max={max} step={step} onChange={(value) => set(key, value)} />)}
      </Section>
    </div>
    </ScrollArea>
  </aside>
}
