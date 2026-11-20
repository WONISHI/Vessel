import { matchesGraphQuery, type GraphSettings, type WorkspaceGraph } from '@vessel/workspace'
/** Build adjacency, edge indices and color matches once per graph, never per animation frame. */
export function graphScene(graph: WorkspaceGraph, settings: GraphSettings) {
  const indices = new Map(graph.nodes.map((node, index) => [node.id, index]))
  const outgoingNeighbors = graph.nodes.map(() => new Set<number>())
  const incomingNeighbors = graph.nodes.map(() => new Set<number>())
  const neighbors = graph.nodes.map(() => new Set<number>())
  const edges: (readonly [number, number])[] = []
  for (const edge of graph.edges) {
    const a = indices.get(edge.source), b = indices.get(edge.target)
    if (a === undefined || b === undefined || a === b) continue
    outgoingNeighbors[a].add(b); incomingNeighbors[b].add(a)
    neighbors[a].add(b); neighbors[b].add(a)
    edges.push([a, b])
  }
  const adjacency = neighbors.map(values => [...values])
  const degrees = Uint32Array.from(neighbors, values => values.size)
  const outgoing = Uint32Array.from(outgoingNeighbors, values => values.size)
  const incoming = Uint32Array.from(incomingNeighbors, values => values.size)
  const colors = graph.nodes.map((node) => settings.groups.find((group) => group.query && matchesGraphQuery(node, group.query))?.color)
  return { edges, degrees, incoming, outgoing, adjacency, colors }
}
