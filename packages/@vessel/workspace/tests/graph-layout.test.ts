import { expect, it } from 'vitest'
import { advanceLayout, createParticles } from '../src/graph/layout'
import { defaultGraphSettings } from '../src/graph/types'
it('keeps a large force layout finite and honors dragged fixed nodes', () => {
 const nodes = Array.from({ length: 2000 }, (_, i) => ({ id: String(i), label: String(i), kind: 'note' as const, tags: [] }))
 const points = createParticles(nodes)
 const edges = nodes.slice(1).map((node, i) => ({ source: String(i), target: node.id, weight: 1 }))
 points[0].fixed = true
 const original = { x: points[0].x, y: points[0].y }
 for (let i = 0; i < 8; i++) advanceLayout(points, edges, defaultGraphSettings, 0.7)
 expect(points.every((point) => Number.isFinite(point.x) && Number.isFinite(point.y))).toBe(true)
 expect(points[0].x).toBe(original.x)
 expect(points[0].y).toBe(original.y)
 expect(points[1].x).not.toBe(createParticles(nodes)[1].x)
})

it('limits total speed without bias toward horizontal or vertical directions', () => {
 const points = [{ id: 'a', x: 1, y: 2, vx: 0, vy: 0 }, { id: 'b', x: 0, y: 0, vx: 0, vy: 0 }]
 advanceLayout(points, [], { ...defaultGraphSettings, center: 0, repel: 1e8 }, 1)
 expect(Math.hypot(points[0].vx, points[0].vy)).toBeCloseTo(35)
 expect(points[0].vy / points[0].vx).toBeCloseTo(2)
 expect(points[1].vx).toBeCloseTo(-points[0].vx)
 expect(points[1].vy).toBeCloseTo(-points[0].vy)
})
