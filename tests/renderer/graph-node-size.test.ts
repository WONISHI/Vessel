import { expect, it } from 'vitest'
import { graphNodeRadius } from '@/components/workspace/graph/node-radius'
import { graphScene } from '@/components/workspace/graph/scene'
import { defaultGraphSettings, type WorkspaceGraph } from '@vessel/workspace'
it('makes hubs bigger at both vault overview and close zoom', () => {
 for (const scale of [0.02, 0.1, 0.5, 1, 3]) {
  const radii = [0, 1, 4, 16, 64, 256].map(count => graphNodeRadius(count, 1, scale) * scale)
  expect(radii.every((value, index) => index === 0 || value > radii[index - 1])).toBe(true)
  expect(radii[4]).toBeGreaterThan(radii[1] * 3)
  expect(graphNodeRadius(64, 2, scale)).toBe(graphNodeRadius(64, 1, scale) * 2)
 }
})
it('shows one branch per linked file without inflating size for repeated or reciprocal links', () => {
 const graph: WorkspaceGraph = {
  nodes: ['hub', 'a', 'b', 'c', 'isolated'].map(id => ({ id, label: id, kind: 'note', tags: [] })),
  edges: [
   { source: 'hub', target: 'a', weight: 20 }, { source: 'hub', target: 'b', weight: 1 },
   { source: 'hub', target: 'c', weight: 1 }, { source: 'a', target: 'hub', weight: 1 }
  ], warnings: [], stats: { files: 5, scanned: 5, reused: 0, elapsedMs: 0 }
 }
 const scene = graphScene(graph, defaultGraphSettings)
 expect([...scene.degrees]).toEqual([3, 1, 1, 1, 0])
 expect(scene.adjacency[0]).toEqual([1, 2, 3])
 expect(scene.outgoing[0]).toBe(3)
 expect(scene.incoming[0]).toBe(1)
 expect(scene.edges).toHaveLength(4)
})
