import { useContext, useEffect, useMemo, useRef, useState } from 'react'
import { WorkspaceVisible } from '@/components/workspace/components/layout-main/document-cache'
import { Network, RefreshCw } from 'lucide-react'
import { useWorkspace } from '@/components/workspace/hooks/useWorkspace'
import { toast } from 'sonner'
import { defaultGraphSettings, filterWorkspaceGraph, type GraphNode, type GraphSettings as Settings, type WorkspaceGraph } from '@vessel/workspace'
import { GraphCanvas } from './graph-canvas'
import { GraphSettings } from './graph-settings'
import { GraphStatus } from './graph-status'
import '@/components/styles/tool-page-header.css'
import { Button } from '@/components/ui/button'
import './graph.css'
function loadSettings(root: string): Settings {
  try {
    const stored = JSON.parse(localStorage.getItem(`vessel-graph:${root}`) || 'null')
    if (!stored || typeof stored !== 'object') return { ...defaultGraphSettings, groups: [] }
    const settings = { ...defaultGraphSettings, groups: [] } as Settings
    for (const key of Object.keys(defaultGraphSettings) as (keyof Settings)[]) {
      if (key !== 'groups' && typeof stored[key] === typeof defaultGraphSettings[key] && (typeof stored[key] !== 'number' || Number.isFinite(stored[key]))) Object.assign(settings, { [key]: stored[key] })
    }
    for (const [key, min, max] of [['depth', 1, 5], ['labels', 0, 3], ['nodeSize', 0.3, 3], ['lineWidth', 0.2, 4], ['center', 0, 0.02], ['repel', 0, 3000], ['linkForce', 0, 0.2], ['linkDistance', 20, 300]] as const) settings[key] = Math.max(min, Math.min(max, settings[key]))
    settings.depth = Math.round(settings.depth)
    settings.groups = Array.isArray(stored.groups) ? stored.groups.filter((group: unknown): group is Settings['groups'][number] => !!group && typeof group === 'object' && typeof (group as { query?: unknown }).query === 'string' && /^#[0-9a-f]{6}$/i.test(String((group as { color?: unknown }).color))) : []
    return settings
  } catch { return { ...defaultGraphSettings, groups: [] } }
}
export default function WorkspaceGraphView() {
  const visible = useContext(WorkspaceVisible)
  return visible ? <WorkspaceGraphContent /> : null
}
function WorkspaceGraphContent() {
  const { workspace, activeFilePath, openWorkspaceFile } = useWorkspace()
  const [graph, setGraph] = useState<WorkspaceGraph>()
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [revision, setRevision] = useState(0)
  const [settings, setSettings] = useState<Settings>(() => loadSettings(workspace.path))
  const prefix = workspace.path.replace(/[\\/]+$/, '')
  const relative = activeFilePath.startsWith(prefix + '/') || activeFilePath.startsWith(prefix + '\\') ? activeFilePath.slice(prefix.length + 1).replace(/\\/g, '/') : ''
  const [localPath, setLocalPath] = useState(relative)
  const root = workspace.path
  const indexing = useRef(false)
  const dirty = useRef(false)
  useEffect(() => {
    let alive = true
    indexing.current = true
    const requestId = crypto.randomUUID()
    const off = window.electronAPI.onWorkspaceGraphProgress?.((value) => {
      if (alive && value.root === root && value.requestId === requestId) setGraph(value.graph)
    })
    void window.electronAPI.readWorkspaceGraph(root, requestId).then((value) => {
      if (!alive) return
      indexing.current = false
      setGraph(value); setLoading(false)
      if (dirty.current) { dirty.current = false; setRevision((value) => value + 1) }
    }, (reason) => {
      if (alive) { indexing.current = false; dirty.current = false; setError(String(reason)); setLoading(false) }
    })
    const stop = () => {
      if (!alive) return
      alive = false
      indexing.current = false
      dirty.current = false
      off?.()
      void window.electronAPI.cancelWorkspaceGraph().catch(() => {})
    }
    window.addEventListener('vessel:graph-close', stop)
    return () => { stop(); window.removeEventListener('vessel:graph-close', stop) }
  }, [root, revision])
  useEffect(() => {
    let alive = true
    let timer: ReturnType<typeof setTimeout> | undefined
    const off = window.electronAPI.onFilesChanged?.((changedRoot) => {
      if (!alive || changedRoot !== root) return
      clearTimeout(timer)
      timer = setTimeout(() => { if (!alive) return; if (indexing.current) dirty.current = true; else setRevision((value) => value + 1) }, 1200)
    })
    const stop = () => { if (!alive) return; alive = false; clearTimeout(timer); off?.() }
    window.addEventListener('vessel:graph-close', stop)
    return () => { stop(); window.removeEventListener('vessel:graph-close', stop) }
  }, [root])
  useEffect(() => { try { localStorage.setItem(`vessel-graph:${root}`, JSON.stringify(settings)) } catch { /* A full settings store does not prevent graph navigation. */ } }, [root, settings])
  const visible = useMemo(() => graph && filterWorkspaceGraph(graph, settings, localPath), [graph, settings, localPath])
  const absolute = (node: GraphNode) => `${root.replace(/[\\/]$/, '')}${root.includes('\\') ? '\\' : '/'}${node.path!.replace(/\//g, root.includes('\\') ? '\\' : '/')}`
  const open = (node: GraphNode) => {
    if (node.kind === 'tag') { setSettings((value) => ({ ...value, query: `tag:"${node.label.slice(1)}"` })); return }
    if (!node.path) { toast.info('这是尚未创建的链接目标'); return }
    openWorkspaceFile({ path: absolute(node), name: node.path.split('/').pop()!, type: 'file' })
  }
  return <section className="workspace-graph-page" aria-label="关系图谱" aria-describedby="workspace-graph-description">
    <header className="tool-page-header workspace-graph-heading">
      <span className="tool-page-brand"><Network /></span>
      <div className="tool-page-heading">
        <h2>关系图谱</h2>
        <p id="workspace-graph-description">{workspace.name} · {visible ? `${visible.nodes.length.toLocaleString()} 个节点 · ${visible.edges.length.toLocaleString()} 条连接` : '本地索引，展示笔记之间的链接'}</p>
      </div>
      <div className="tool-page-actions">
        <Button type="button" className="workspace-graph-header-button workspace-graph-refresh-button shrink-0 whitespace-nowrap bg-green-600 text-white hover:bg-green-700" disabled={loading} onClick={() => { setLoading(true); setError(''); setRevision((value) => value + 1) }}><RefreshCw />刷新索引</Button>
      </div>
    </header>
    <div className="workspace-graph-body">
      <div className="workspace-graph-main">{visible && <GraphCanvas graph={visible} settings={settings} activePath={relative} onOpen={open} onLocal={(node) => { setLocalPath(node.path || ''); setSettings((value) => ({ ...value, local: true })) }} onReveal={(node) => { void window.electronAPI.revealWorkspaceFile(root, absolute(node)).catch((error) => toast.error(String(error))) }} />}

        {error && <div role="alert" className="workspace-graph-error"><strong>无法读取关系图谱</strong><p>{error}</p><button onClick={() => { setLoading(true); setError(''); setRevision((value) => value + 1) }}>重试</button></div>}
      </div>
      <GraphSettings settings={settings} onChange={setSettings} activeLabel={localPath || ''} />
    </div>
    <GraphStatus graph={graph} />
  </section>
}
