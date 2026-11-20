import { advanceLayout, createParticles, type Particle } from '@vessel/workspace'
import type { GraphEdge, GraphNode, GraphSettings } from '@vessel/workspace'
let points: Particle[] = [], edges: GraphEdge[] = []
let settings: GraphSettings
let timer: ReturnType<typeof setTimeout> | undefined
let alpha = 1
let generation = 0
function tick() {
  if (!settings) return
  advanceLayout(points, edges, settings, alpha)
  const values = new Float32Array(points.length * 2)
  points.forEach((point, index) => { values[index * 2] = point.x; values[index * 2 + 1] = point.y })
  self.postMessage({ generation, positions: values }, { transfer: [values.buffer] })
  alpha *= 0.985
  if (alpha > 0.012) timer = setTimeout(tick, 32)
  else timer = undefined
}
self.onmessage = (event: MessageEvent) => {
  const message = event.data
  if (message.type === 'graph') {
    clearTimeout(timer)
    generation = message.generation
    points = createParticles(message.nodes as GraphNode[], new Map(points.map((point) => [point.id, point])))
    edges = message.edges; settings = message.settings; alpha = 1
    tick()
  } else if (message.type === 'drag') {
    const point = points.find((point) => point.id === message.id)
    if (point) { point.x = message.x; point.y = message.y; point.fixed = message.fixed; point.vx = 0; point.vy = 0 }
    alpha = Math.max(alpha, 0.3)
    if (!timer) tick()
  }
}
