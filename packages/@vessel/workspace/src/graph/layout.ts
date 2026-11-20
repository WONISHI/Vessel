import type { GraphEdge, GraphNode, GraphSettings } from './types'
export interface Particle { id: string; x: number; y: number; vx: number; vy: number; fixed?: boolean }
interface Cell { x: number; y: number; width: number; mass: number; cx: number; cy: number; children?: Cell[]; particles?: Particle[] }
function tree(points: Particle[], x: number, y: number, width: number, depth = 0): Cell {
  const cell: Cell = { x, y, width, mass: points.length, cx: 0, cy: 0 }
  for (const point of points) { cell.cx += point.x; cell.cy += point.y }
  if (points.length) { cell.cx /= points.length; cell.cy /= points.length }
  if (points.length <= 4 || depth >= 18) { cell.particles = points; return cell }
  const half = width / 2
  const groups: Particle[][] = [[], [], [], []]
  for (const point of points) groups[(point.x >= x + half ? 1 : 0) + (point.y >= y + half ? 2 : 0)].push(point)
  cell.children = groups.map((group, index) => tree(group, x + (index % 2) * half, y + (index >= 2 ? half : 0), half, depth + 1)).filter((child) => child.mass)
  return cell
}
export function createParticles(nodes: GraphNode[], previous: Map<string, Particle> = new Map()): Particle[] {
  return nodes.map((node, index) => {
    const old = previous.get(node.id)
    const radius = Math.sqrt(index + 1) * 12, angle = index * 2.3999632297
    return { id: node.id, x: old?.x ?? radius * Math.cos(angle), y: old?.y ?? radius * Math.sin(angle), vx: 0, vy: 0 }
  })
}

/** Barnes–Hut approximation keeps repulsion near O(n log n), instead of all node pairs. */
export function advanceLayout(points: Particle[], edges: GraphEdge[], settings: Pick<GraphSettings, 'center' | 'repel' | 'linkForce' | 'linkDistance'>, alpha: number): void {
  if (!points.length) return
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const point of points) { minX = Math.min(minX, point.x); maxX = Math.max(maxX, point.x); minY = Math.min(minY, point.y); maxY = Math.max(maxY, point.y) }
  const root = tree(points, minX - 1, minY - 1, Math.max(2, maxX - minX + 2, maxY - minY + 2))
  const byId = new Map(points.map((point) => [point.id, point]))
  const repel = (point: Particle, cell: Cell) => {
    let dx = point.x - cell.cx, dy = point.y - cell.cy
    const distance = dx * dx + dy * dy + 25
    const contains = point.x >= cell.x && point.x <= cell.x + cell.width && point.y >= cell.y && point.y <= cell.y + cell.width
    if (cell.children && (contains || cell.width * cell.width / distance > 0.64)) { for (const child of cell.children) repel(point, child); return }
    if (cell.particles) {
      for (const other of cell.particles) if (point !== other) {
        dx = point.x - other.x; dy = point.y - other.y
        if (Math.abs(dx) + Math.abs(dy) < 0.001) dx = 0.1
        const force = settings.repel * alpha / (dx * dx + dy * dy + 25)
        point.vx += dx * force; point.vy += dy * force
      }
    } else {
      const force = settings.repel * cell.mass * alpha / distance
      point.vx += dx * force; point.vy += dy * force
    }
  }
  for (const point of points) {
    if (point.fixed) continue
    repel(point, root)
    point.vx -= point.x * settings.center * alpha
    point.vy -= point.y * settings.center * alpha
  }
  for (const edge of edges) {
    const a = byId.get(edge.source), b = byId.get(edge.target)
    if (!a || !b) continue
    const dx = b.x - a.x, dy = b.y - a.y, distance = Math.max(1, Math.hypot(dx, dy))
    const force = (distance - settings.linkDistance) / distance * settings.linkForce * alpha
    if (!a.fixed) { a.vx += dx * force; a.vy += dy * force }
    if (!b.fixed) { b.vx -= dx * force; b.vy -= dy * force }
  }
  for (const point of points) {
    if (point.fixed) { point.vx = 0; point.vy = 0; continue }
    // Limit speed, not individual axes: axis clipping turns dense clouds into a square.
    const speed = Math.hypot(point.vx, point.vy)
    const damping = speed > 35 / 0.75 ? 35 / speed : 0.75
    point.vx *= damping; point.vy *= damping
    point.x += point.vx; point.y += point.vy
  }
}
