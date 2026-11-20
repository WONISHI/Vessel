export type GraphNodeKind = 'note' | 'attachment' | 'tag' | 'unresolved'
export interface GraphNode { id: string; path?: string; label: string; kind: GraphNodeKind; tags: string[]; modifiedMs?: number }
export interface GraphEdge { source: string; target: string; weight: number }
export interface WorkspaceGraph {
  nodes: GraphNode[]; edges: GraphEdge[]
  stats: { scanned: number; reused: number; elapsedMs: number; files: number }
  warnings: string[]
}
export interface IndexedFile { path: string; title: string; kind: 'note' | 'attachment'; links: { target: string; wiki: boolean }[]; tags: string[]; modifiedMs: number }
export interface RawIndex { version: number; files: IndexedFile[]; warnings: string[]; scanned: number; reused: number; elapsedMs: number }
export interface ColorGroup { query: string; color: string }
export interface GraphSettings {
  query: string; tags: boolean; attachments: boolean; existingOnly: boolean; orphans: boolean
  local: boolean; depth: number; incoming: boolean; outgoing: boolean
  arrows: boolean; labels: number; nodeSize: number; lineWidth: number
  center: number; repel: number; linkForce: number; linkDistance: number
  groups: ColorGroup[]
}
export const defaultGraphSettings: GraphSettings = {
  query: '', tags: false, attachments: false, existingOnly: false, orphans: true,
  local: false, depth: 1, incoming: true, outgoing: true,
  arrows: false, labels: 1, nodeSize: 1, lineWidth: 1,
  center: 0.002, repel: 900, linkForce: 0.04, linkDistance: 90, groups: []
}
