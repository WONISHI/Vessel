import { MIN_GRAPH_SCALE, clampGraphScale } from "./viewport"
import { graphNodeRadius } from "./node-radius"
import { graphScene } from "./scene"
import { useEffect, useMemo, useRef, useState } from 'react'
import { Maximize, Minus, Plus } from 'lucide-react'
import { ContextMenu, ContextMenuContent, ContextMenuItem, ContextMenuTrigger } from '@/components/ui/context-menu'
import { type GraphNode, type GraphSettings, type WorkspaceGraph } from '@vessel/workspace'

/** Canvas drawing stays on the UI thread; the force simulation runs in a dedicated worker. */
export function GraphCanvas({ graph, settings, activePath, onOpen, onLocal, onReveal }: {
  graph: WorkspaceGraph; settings: GraphSettings; activePath?: string
  onOpen: (node: GraphNode) => void; onLocal: (node: GraphNode) => void; onReveal: (node: GraphNode) => void
}) {
  const canvas = useRef<HTMLCanvasElement>(null)
  const worker = useRef<Worker | null>(null)
  const generation = useRef(0)
  const autoFit = useRef(true)
  const positions = useRef(new Float32Array())
  const view = useRef({ x: 0, y: 0, scale: 1 })
  const pointer = useRef<{ id: number; startX: number; startY: number; x: number; y: number; node?: number; moved: boolean } | null>(null)
  const [hover, setHover] = useState<number | null>(null)
  const [context, setContext] = useState<GraphNode>()
  const scene = useMemo(() => graphScene(graph, settings), [graph, settings])
  const state = useRef({ graph, settings, activePath, hover, scene })
  const size = useRef({ width: 800, height: 600 })
  const fit = () => {
    const points = positions.current
    if (!points.length) { view.current = { x: 0, y: 0, scale: 1 }; return }
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    for (let i = 0; i < points.length; i += 2) { minX = Math.min(minX, points[i]); maxX = Math.max(maxX, points[i]); minY = Math.min(minY, points[i + 1]); maxY = Math.max(maxY, points[i + 1]) }
    const scale = Math.min(3, Math.max(MIN_GRAPH_SCALE, Math.min((size.current.width - 100) / Math.max(1, maxX - minX), (size.current.height - 100) / Math.max(1, maxY - minY))))
    view.current = { scale, x: -(minX + maxX) / 2 * scale, y: -(minY + maxY) / 2 * scale }
  }
  useEffect(() => { state.current = { graph, settings, activePath, hover, scene } }, [graph, settings, activePath, hover, scene])
  useEffect(() => {
    const instance = new Worker(new URL('./layout.worker.ts', import.meta.url), { type: 'module' })
    let stopped = false
    worker.current = instance
    instance.onmessage = (event) => {
      if (!stopped && event.data.generation === generation.current) {
        positions.current = event.data.positions
        if (autoFit.current && positions.current.length) fit()
      }
    }
    const stop = () => { if (stopped) return; stopped = true; instance.onmessage = null; worker.current = null; positions.current = new Float32Array(); instance.terminate() }
    window.addEventListener('vessel:graph-close', stop)
    return () => { stop(); window.removeEventListener('vessel:graph-close', stop) }
  }, [])
  useEffect(() => {
    if (pointer.current?.node !== undefined) pointer.current = null
    generation.current++
    positions.current = new Float32Array()
    worker.current?.postMessage({ type: 'graph', generation: generation.current, nodes: graph.nodes, edges: graph.edges, settings })
  }, [graph, settings])
  useEffect(() => {
    const element = canvas.current!
    const observer = new ResizeObserver(() => {
      const rect = element.getBoundingClientRect()
      size.current = { width: rect.width, height: rect.height }
      const ratio = window.devicePixelRatio || 1
      element.width = rect.width * ratio; element.height = rect.height * ratio
    })
    observer.observe(element)
    let frame = 0
    let lastFrame = 0
    let stopped = false
    const draw = (time: number) => {
      if (stopped) return
      if (time - lastFrame < 32) { frame = requestAnimationFrame(draw); return }
      lastFrame = time
      const ctx = element.getContext('2d')
      if (!ctx) return
      const { width, height } = size.current
      const { x, y, scale } = view.current
      const { graph: data, settings: options, activePath: active, hover: hovered, scene: prepared } = state.current
      const coords = positions.current
      const dark = document.documentElement.classList.contains('dark')
      ctx.setTransform(window.devicePixelRatio || 1, 0, 0, window.devicePixelRatio || 1, 0, 0)
      ctx.clearRect(0, 0, width, height)
      ctx.translate(width / 2 + x, height / 2 + y); ctx.scale(scale, scale)
      if (coords.length === data.nodes.length * 2) {
        const { edges, degrees, adjacency, colors } = prepared
        const neighbors = new Set(hovered === null ? [] : adjacency[hovered])
        const radius = (index: number) => graphNodeRadius(degrees[index], options.nodeSize, scale)
        const batches = hovered === null ? [false] : [false, true]
        for (const highlight of batches) {
          ctx.globalAlpha = hovered === null ? 0.4 : highlight ? 0.9 : 0.08
          ctx.strokeStyle = highlight ? '#10b981' : dark ? '#71717a' : '#a3a3a3'
          ctx.lineWidth = options.lineWidth / Math.sqrt(scale)
          ctx.beginPath()
          for (const [a, b] of edges) {
            const related = hovered === a || hovered === b
            if (hovered !== null && related !== highlight) continue
            const ax = coords[a * 2], ay = coords[a * 2 + 1], bx = coords[b * 2], by = coords[b * 2 + 1]
            ctx.moveTo(ax, ay); ctx.lineTo(bx, by)
            if (options.arrows) {
              const angle = Math.atan2(by - ay, bx - ax), r = radius(b) + 3
              const tx = bx - Math.cos(angle) * r, ty = by - Math.sin(angle) * r
              ctx.moveTo(tx - Math.cos(angle - 0.5) * 6, ty - Math.sin(angle - 0.5) * 6); ctx.lineTo(tx, ty); ctx.lineTo(tx - Math.cos(angle + 0.5) * 6, ty - Math.sin(angle + 0.5) * 6)
            }
          }
          ctx.stroke()
        }
        data.nodes.forEach((node, index) => {
          const px = coords[index * 2], py = coords[index * 2 + 1]
          if (Math.abs(px * scale + x) > width / 2 + 100 || Math.abs(py * scale + y) > height / 2 + 100) return
          const related = hovered === index || neighbors.has(index), selected = node.path === active
          ctx.globalAlpha = hovered === null || related ? 1 : 0.2
          ctx.fillStyle = selected || hovered === index ? '#10b981' : colors[index] || (node.kind === 'tag' ? '#d99b38' : node.kind === 'unresolved' ? '#9da3ab' : node.kind === 'attachment' ? '#8d80dc' : dark ? '#a1a1aa' : '#737373')
          ctx.beginPath(); ctx.arc(px, py, radius(index), 0, Math.PI * 2); ctx.fill()
          if (selected) { ctx.strokeStyle = '#10b981'; ctx.lineWidth = 1.5 / scale; ctx.beginPath(); ctx.arc(px, py, radius(index) + 4 / scale, 0, Math.PI * 2); ctx.stroke() }
          // Avoid rendering tens of thousands of labels when zoomed out.
          if (related || selected || (options.labels > 0 && data.nodes.length < 2500 * scale * options.labels)) {
            ctx.globalAlpha = related || selected ? 1 : Math.min(1, Math.max(0.55, scale * options.labels))
            ctx.fillStyle = dark ? '#e5e7eb' : '#4b5563'; ctx.font = `${11 / scale}px system-ui`; ctx.textAlign = 'center'
            ctx.fillText(node.label, px, py + radius(index) + 14 / scale)
          }
        })
      }
      ctx.globalAlpha = 1
      frame = requestAnimationFrame(draw)
    }
    frame = requestAnimationFrame(draw)
    const wheel = (event: WheelEvent) => {
      event.preventDefault()
      event.stopPropagation()
      autoFit.current = false
      const rect = element.getBoundingClientRect(), old = view.current
      // Mouse wheels may report lines or pages, while trackpads report pixels.
      const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? size.current.height : 1
      const delta = Math.max(-240, Math.min(240, event.deltaY * unit))
      const scale = clampGraphScale(old.scale * Math.exp(-delta * 0.0015))
      const px = event.clientX - rect.left - size.current.width / 2, py = event.clientY - rect.top - size.current.height / 2
      view.current = { scale, x: px - (px - old.x) * scale / old.scale, y: py - (py - old.y) * scale / old.scale }
    }
    element.addEventListener('wheel', wheel, { passive: false })
    const stop = () => { if (stopped) return; stopped = true; observer.disconnect(); cancelAnimationFrame(frame); element.removeEventListener('wheel', wheel) }
    window.addEventListener('vessel:graph-close', stop)
    return () => { stop(); window.removeEventListener('vessel:graph-close', stop) }
  }, [])
  const pointAt = (clientX: number, clientY: number) => {
    const rect = canvas.current!.getBoundingClientRect(), { x, y, scale } = view.current
    return { x: (clientX - rect.left - size.current.width / 2 - x) / scale, y: (clientY - rect.top - size.current.height / 2 - y) / scale }
  }
  const hit = (clientX: number, clientY: number) => {
    const point = pointAt(clientX, clientY), coords = positions.current
    let index: number | undefined, distance = Infinity
    const scale = view.current.scale
    for (let i = 0; i < coords.length; i += 2) {
      const next = Math.hypot(point.x - coords[i], point.y - coords[i + 1])
      const radius = Math.max(8 / scale, graphNodeRadius(scene.degrees[i / 2], settings.nodeSize, scale) + 3 / scale)
      if (next <= radius && next < distance) { distance = next; index = i / 2 }
    }
    return index
  }
  const cancelDrag = () => {
    const drag = pointer.current; pointer.current = null
    if (canvas.current) canvas.current.style.cursor = ''
    if (drag?.node === undefined || !graph.nodes[drag.node]) return
    worker.current?.postMessage({ type: 'drag', id: graph.nodes[drag.node].id, x: positions.current[drag.node * 2], y: positions.current[drag.node * 2 + 1], fixed: false })
  }
  return <div className="workspace-graph-canvas">
    <ContextMenu><ContextMenuTrigger asChild>
      <canvas ref={canvas} tabIndex={0} role="img" aria-label="工作区关系图谱，滚轮缩放，按住中键或拖动空白处平移，点击节点打开文件" title={hover === null ? undefined : `${graph.nodes[hover]?.path || graph.nodes[hover]?.label} · 引用 ${scene.outgoing[hover]} 个文件 · 被引用 ${scene.incoming[hover]} 个文件`}
        onContextMenuCapture={(event) => { const index = hit(event.clientX, event.clientY); setContext(index === undefined ? undefined : graph.nodes[index]) }}
        onPointerDown={(event) => {
          if (event.button !== 0 && event.button !== 1) return
          event.preventDefault()
          autoFit.current = false
          const index = event.button === 1 ? undefined : hit(event.clientX, event.clientY)
          if (index === undefined && canvas.current) canvas.current.style.cursor = 'grabbing' 
          canvas.current?.setPointerCapture(event.pointerId)
          pointer.current = { id: event.pointerId, startX: event.clientX, startY: event.clientY, x: event.clientX, y: event.clientY, node: index, moved: false }
        }}
        onPointerMove={(event) => {
          const drag = pointer.current
          if (drag) {
            drag.moved ||= Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) > 4
            if (drag.node !== undefined) worker.current?.postMessage({ type: 'drag', id: graph.nodes[drag.node].id, ...pointAt(event.clientX, event.clientY), fixed: true })
            else { view.current.x += event.clientX - drag.x; view.current.y += event.clientY - drag.y }
            drag.x = event.clientX; drag.y = event.clientY
          } else setHover(hit(event.clientX, event.clientY) ?? null)
        }}
        onPointerUp={(event) => {
          const drag = pointer.current; pointer.current = null
          if (canvas.current) canvas.current.style.cursor = ''
          if (canvas.current?.hasPointerCapture(event.pointerId)) canvas.current.releasePointerCapture(event.pointerId)
          if (drag?.node !== undefined) {
            const node = graph.nodes[drag.node]
            worker.current?.postMessage({ type: 'drag', id: node.id, ...pointAt(event.clientX, event.clientY), fixed: false })
            if (!drag.moved) onOpen(node)
          }
        }}
        onAuxClick={(event) => { if (event.button === 1) event.preventDefault() }}
        onPointerCancel={cancelDrag}
        onLostPointerCapture={cancelDrag}
        onPointerLeave={() => setHover(null)}
        onKeyDown={(event) => {
          if (['+', '=', '-', '0', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) event.preventDefault()
          autoFit.current = false
          if (event.key === '+' || event.key === '=') view.current.scale = clampGraphScale(view.current.scale * 1.2)
          if (event.key === '-') view.current.scale = clampGraphScale(view.current.scale / 1.2)
          if (event.key === '0') fit()
          const step = event.shiftKey ? 100 : 25
          if (event.key === 'ArrowLeft') view.current.x += step
          if (event.key === 'ArrowRight') view.current.x -= step
          if (event.key === 'ArrowUp') view.current.y += step
          if (event.key === 'ArrowDown') view.current.y -= step
        }} />
    </ContextMenuTrigger><ContextMenuContent>
      {context && <><ContextMenuItem disabled={!context.path} onSelect={() => onOpen(context)}>打开文件</ContextMenuItem><ContextMenuItem disabled={!context.path} onSelect={() => onLocal(context)}>查看局部图谱</ContextMenuItem><ContextMenuItem disabled={!context.path} onSelect={() => onReveal(context)}>在资源管理器中显示</ContextMenuItem></>}
      <ContextMenuItem onSelect={fit}>适应画布</ContextMenuItem>
    </ContextMenuContent></ContextMenu>
    <div className="workspace-graph-view-tools"><button aria-label="放大图谱" onClick={() => { autoFit.current = false; view.current.scale = clampGraphScale(view.current.scale * 1.2) }}><Plus size={15} /></button><button aria-label="缩小图谱" onClick={() => { autoFit.current = false; view.current.scale = clampGraphScale(view.current.scale / 1.2) }}><Minus size={15} /></button><button aria-label="适应画布" onClick={() => { autoFit.current = true; fit() }}><Maximize size={15} /></button></div>
    {!graph.nodes.length && <p className="workspace-graph-empty">没有符合筛选条件的节点</p>}
    <p className="workspace-graph-hint">滚轮缩放 · 按住中键或拖动空白处平移 · 拖动节点 · 点击打开文件</p>
  </div>
}
