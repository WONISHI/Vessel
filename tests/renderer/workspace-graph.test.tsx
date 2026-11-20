import { WorkspaceVisible } from "@/components/workspace/components/layout-main/document-cache"
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import WorkspaceGraphView from '@/components/workspace/graph/graph-view'
import WorkspaceGraphPage from '@/components/workspace/graph/graph-page'
import type { GraphNode, WorkspaceGraph } from '@vessel/workspace'
const context = vi.hoisted(() => ({ openWorkspaceFile: vi.fn() }))
vi.mock('@/components/workspace/hooks/useWorkspace', () => ({ useWorkspace: () => ({ workspace: { path: '/vault', name: '笔记' }, activeFilePath: '/vault/a.md', openFiles: [{ path: '/vault/a.md', name: 'a.md', type: 'file' }], navigateToWorkspaceHome: vi.fn(), openWorkspaceFile: context.openWorkspaceFile }) }))
vi.mock('@/components/workspace/graph/graph-canvas', () => ({ GraphCanvas: ({ graph, onOpen, onLocal }: { graph: WorkspaceGraph; onOpen: (node: GraphNode) => void; onLocal: (node: GraphNode) => void }) => <div>{graph.nodes.map((node) => <div key={node.id}><button onClick={() => onOpen(node)}>{node.label}</button><button aria-label={`局部 ${node.label}`} onClick={() => onLocal(node)}>局部</button></div>)}</div> }))
const graph: WorkspaceGraph = {
 nodes: [{ id: 'a.md', path: 'a.md', label: '文档 A', kind: 'note', tags: [] }, { id: 'sub/b.md', path: 'sub/b.md', label: '文档 B', kind: 'note', tags: [] }, { id: 'orphan.md', path: 'orphan.md', label: '孤立文档', kind: 'note', tags: [] }],
 edges: [{ source: 'a.md', target: 'sub/b.md', weight: 1 }], warnings: [], stats: { files: 3, scanned: 1, reused: 2, elapsedMs: 10 }
}
beforeEach(() => {
 vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} })
 localStorage.clear()
 window.electronAPI = { ...window.electronAPI, readWorkspaceGraph: vi.fn(async () => graph), cancelWorkspaceGraph: vi.fn(async () => {}), onWorkspaceGraphProgress: vi.fn(() => vi.fn()), onFilesChanged: vi.fn(() => vi.fn()) }
})
afterEach(() => { cleanup(); vi.clearAllMocks(); vi.unstubAllGlobals() })
it('loads the current root, filters and opens a graph node as a workspace tab', async () => {
 render(<WorkspaceGraphView />)
 await screen.findByText('文档 B')
 expect(window.electronAPI.readWorkspaceGraph).toHaveBeenCalledWith('/vault', expect.any(String))
 fireEvent.change(screen.getByLabelText('搜索图谱'), { target: { value: 'path:sub/' } })
 expect(screen.queryByText('文档 A')).toBeNull()
 fireEvent.click(screen.getByText('文档 B'))
 expect(context.openWorkspaceFile).toHaveBeenCalledWith({ path: '/vault/sub/b.md', name: 'b.md', type: 'file' })
 expect(screen.queryByRole('dialog')).toBeNull()
 expect(screen.getByRole('region', { name: '关系图谱' })).toBeTruthy()
})
it('shows local graph filters, preserves settings and cancels on close', async () => {
 const result = render(<WorkspaceGraphView />)
 await screen.findByText('文档 A')
 fireEvent.click(screen.getByLabelText('局部 文档 A'))
 expect(screen.queryByText('孤立文档')).toBeNull()
 expect(screen.getByRole('slider', { name: '局部图谱深度' })).toBeTruthy()
 expect(JSON.parse(localStorage.getItem('vessel-graph:/vault')!).local).toBe(true)
 result.unmount()
 await waitFor(() => expect(window.electronAPI.cancelWorkspaceGraph).toHaveBeenCalledOnce())
})
it('reports indexing errors and allows a retry', async () => {
 vi.mocked(window.electronAPI.readWorkspaceGraph).mockRejectedValueOnce(new Error('permission denied'))
 render(<WorkspaceGraphView />)
 expect((await screen.findByRole('alert')).textContent).toContain('permission denied')
 fireEvent.click(screen.getByText('重试'))
 expect(await screen.findByText('文档 A')).toBeTruthy()
})

it('shows the graph header without a back button and refreshes the current index', async () => {
 render(<WorkspaceGraphPage />)
 await screen.findByText('文档 A')
 expect(screen.queryByRole('button', { name: '返回文档' })).toBeNull()
 fireEvent.click(screen.getByRole('button', { name: '刷新索引' }))
 await waitFor(() => expect(window.electronAPI.readWorkspaceGraph).toHaveBeenCalledTimes(2))
})

it('uses shadcn collapsibles and ScrollArea while keeping graph settings editable', async () => {
 render(<WorkspaceGraphView />)
 await screen.findByText('文档 A')
 const sidebar = screen.getByRole('complementary', { name: '图谱设置' })
 expect(sidebar.querySelector('[data-radix-scroll-area-viewport]')).toBeTruthy()
 expect(sidebar.querySelector('details')).toBeNull()
 const display = screen.getByRole('button', { name: '显示' })
 expect(display.getAttribute('aria-expanded')).toBe('false')
 fireEvent.click(display)
 expect(screen.getByRole('slider', { name: '节点大小' })).toBeTruthy()
 fireEvent.click(screen.getByRole('checkbox', { name: '连线方向箭头' }))
 expect(JSON.parse(localStorage.getItem('vessel-graph:/vault')!).arrows).toBe(true)
 fireEvent.click(display)
 expect(display.getAttribute('aria-expanded')).toBe('false')
})

it('renders partial batches before indexing completes without a loading overlay', async () => {
 let requestId: string | undefined
 let publish: ((value: { root: string; requestId?: string; graph: WorkspaceGraph }) => void) | undefined
 let finish!: (value: WorkspaceGraph) => void
 const off = vi.fn()
 window.electronAPI.onWorkspaceGraphProgress = (callback) => { publish = callback; return off }
 window.electronAPI.readWorkspaceGraph = vi.fn((_root, id) => { requestId = id; return new Promise(resolve => { finish = resolve }) })
 const view = render(<WorkspaceGraphView />)
 expect(screen.queryByText('正在构建关系图谱…')).toBeNull()
 const partial = { ...graph, nodes: [graph.nodes[0]], edges: [], stats: { ...graph.stats, files: 1 } }
 act(() => publish?.({ root: '/vault', requestId: 'stale-request', graph: partial }))
 expect(screen.queryByText('文档 A')).toBeNull()
 act(() => publish?.({ root: '/vault', requestId, graph: partial }))
 expect(screen.getByText('文档 A')).toBeTruthy()
 expect(screen.queryByText('文档 B')).toBeNull()
 await act(async () => finish(graph))
 expect(screen.getByText('文档 B')).toBeTruthy()
 view.unmount()
 expect(off).toHaveBeenCalledOnce()
})

it('stops indexing, progress delivery and queued refreshes immediately on close', async () => {
 let changed!: (root: string) => void
 let publish!: (value: { root: string; requestId?: string; graph: WorkspaceGraph }) => void
 let finish!: (value: WorkspaceGraph) => void
 const offProgress = vi.fn(), offChanges = vi.fn()
 window.electronAPI.onFilesChanged = (callback) => { changed = callback as typeof changed; return offChanges }
 window.electronAPI.onWorkspaceGraphProgress = (callback) => { publish = callback; return offProgress }
 window.electronAPI.readWorkspaceGraph = vi.fn(() => new Promise((resolve) => { finish = resolve }))
 const view = render(<WorkspaceGraphView />)
 const requestId = vi.mocked(window.electronAPI.readWorkspaceGraph).mock.calls[0][1]
 vi.useFakeTimers()
 try {
  act(() => changed('/vault'))
  act(() => window.dispatchEvent(new Event('vessel:graph-close')))
  expect(window.electronAPI.cancelWorkspaceGraph).toHaveBeenCalledOnce()
  expect(offProgress).toHaveBeenCalledOnce(); expect(offChanges).toHaveBeenCalledOnce()
  act(() => { publish({ root:'/vault', requestId, graph }); changed('/vault'); vi.advanceTimersByTime(2000) })
  await act(async () => finish(graph))
  expect(screen.queryByText('文档 A')).toBeNull()
  expect(window.electronAPI.readWorkspaceGraph).toHaveBeenCalledTimes(1)
  view.unmount()
  expect(window.electronAPI.cancelWorkspaceGraph).toHaveBeenCalledOnce()
 } finally { vi.useRealTimers() }
})

it('releases the graph when a cached workspace becomes hidden', async () => {
 const view = render(<WorkspaceVisible.Provider value={true}><WorkspaceGraphView /></WorkspaceVisible.Provider>)
 await screen.findByText('文档 A')
 view.rerender(<WorkspaceVisible.Provider value={false}><WorkspaceGraphView /></WorkspaceVisible.Provider>)
 expect(window.electronAPI.cancelWorkspaceGraph).toHaveBeenCalledOnce()
 expect(screen.queryByRole('region', { name: '关系图谱' })).toBeNull()
})
