import { MIN_GRAPH_SCALE } from "./viewport"
/** Keep connected hubs visibly larger even when the whole vault is zoomed out. */
export function graphNodeRadius(connections: number, nodeSize: number, scale: number) {
  const count = Math.max(0, connections)
  const worldRadius = (3 + Math.sqrt(count) * 1.6) * nodeSize
  const screenRadius = (1.35 + Math.log2(count + 1) * 1.1) * nodeSize
  return Math.max(worldRadius, screenRadius / Math.max(MIN_GRAPH_SCALE, scale))
}
