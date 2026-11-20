import type { GraphEdge, GraphNode, GraphSettings, RawIndex, WorkspaceGraph } from './types'
const noteExtension = /\.(md|markdown|mdown)$/i
const imageExtension = /\.(?:png|jpe?g|gif|webp|svg|avif|bmp|ico|tiff?|heic|heif|apng|jxl)$/i
const withoutExtension = (path: string) => path.replace(noteExtension, '')
function normalize(path: string): string | undefined {
  const parts: string[] = []
  for (const part of path.replace(/\\/g, '/').split('/')) {
    if (!part || part === '.') continue
    if (part === '..') { if (!parts.length) return; parts.pop() } else parts.push(part)
  }
  return parts.join('/')
}
function decode(value: string) { try { return decodeURIComponent(value) } catch { return value } }

/** Resolve links using indexed paths only; never open an arbitrary filesystem target. */
export function buildWorkspaceGraph(index: RawIndex): WorkspaceGraph {
  const nodes = new Map<string, GraphNode>()
  const exact = new Map<string, string>()
  const suffixes = new Map<string, string[]>()
  for (const file of index.files) {
    if (imageExtension.test(file.path)) continue
    nodes.set(file.path, { id: file.path, path: file.path, label: file.title, kind: file.kind, tags: file.tags, modifiedMs: file.modifiedMs })
    exact.set(file.path, file.path)
    if (file.kind === 'note') exact.set(withoutExtension(file.path), file.path)
    const parts = file.path.split('/')
    for (let i = 0; i < parts.length; i++) {
      const suffix = parts.slice(i).join('/')
      for (const key of new Set([suffix, file.kind === 'note' ? withoutExtension(suffix) : suffix])) {
        const paths = suffixes.get(key) || []; paths.push(file.path); suffixes.set(key, paths)
      }
    }
  }
  const edges = new Map<string, GraphEdge>()
  const connect = (source: string, target: string) => {
    if (source === target) return
    const key = JSON.stringify([source, target])
    const previous = edges.get(key)
    if (previous) previous.weight++
    else edges.set(key, { source, target, weight: 1 })
  }
  for (const file of index.files) {
    if (imageExtension.test(file.path)) continue
    const directory = file.path.split('/').slice(0, -1).join('/')
    for (const raw of file.links) {
      // Decode after splitting fragments so a literal encoded # remains part of the filename.
      const target = decode(raw.target.split('#')[0].split('?')[0]).trim()
      if (!target || imageExtension.test(target) || /^(?:[a-z][\w+.-]*:|\/\/)/i.test(target)) continue
      const relative = normalize(`${directory}/${target}`)
      const root = normalize(target)
      const absolute = target.startsWith('/')
      const direct = absolute ? exact.get(root || '') : exact.get(relative || '') || (raw.wiki ? exact.get(root || '') : undefined)
      const candidates = raw.wiki && !absolute && root ? suffixes.get(root) || [] : []
      // Prefer nearby notes when an unqualified name exists in several folders.
      const common = (path: string) => { const a = directory.split('/'), b = path.split('/'); let n = 0; while (n < a.length && a[n] === b[n]) n++; return n }
      const resolved = direct || [...candidates].sort((a, b) => common(b) - common(a) || a.localeCompare(b))[0]
      if (!resolved && !root && !relative) continue
      const id = resolved || `missing:${target.startsWith('/') || raw.wiki ? root || relative : relative}`
      if (!nodes.has(id)) nodes.set(id, { id, label: withoutExtension(target), kind: 'unresolved', tags: [] })
      connect(file.path, id)
    }
    for (const tag of file.tags) {
      const id = `tag:${tag}`
      if (!nodes.has(id)) nodes.set(id, { id, label: `#${tag}`, kind: 'tag', tags: [tag] })
      connect(file.path, id)
    }
  }
  return { nodes: [...nodes.values()], edges: [...edges.values()], warnings: index.warnings, stats: { files: index.files.length, scanned: index.scanned, reused: index.reused, elapsedMs: index.elapsedMs } }
}

/** Small, predictable query language: text, path:, file:, tag:, quoted phrases and -exclusions. */
export function matchesGraphQuery(node: GraphNode, query: string): boolean {
  const terms = query.match(/-?(?:path:|file:|tag:)?(?:"[^"]*"|\S+)/g) || []
  return terms.every((raw) => {
    const negative = raw.startsWith('-')
    const value = (negative ? raw.slice(1) : raw).toLocaleLowerCase()
    const [field, ...rest] = value.split(':')
    const known = ['path', 'file', 'tag'].includes(field)
    const term = (known ? rest.join(':') : value).replace(/^"|"$/g, '').replace(/^#/, '')
    const source = field === 'tag' ? node.tags.join(' ') : field === 'file' ? node.label : known ? node.path || '' : `${node.label} ${node.path || ''} ${node.tags.join(' ')}`
    const match = source.toLocaleLowerCase().includes(term)
    return negative ? !match : match
  })
}
export function filterWorkspaceGraph(graph: WorkspaceGraph, settings: GraphSettings, activePath?: string): WorkspaceGraph {
  let local: Set<string> | undefined
  if (settings.local) {
    local = new Set(activePath ? [activePath] : [])
    const neighbors = new Map<string, string[]>()
    const add = (a: string, b: string) => { const list = neighbors.get(a) || []; list.push(b); neighbors.set(a, list) }
    for (const edge of graph.edges) {
      if (settings.outgoing) add(edge.source, edge.target)
      if (settings.incoming) add(edge.target, edge.source)
    }
    let frontier = [...local]
    for (let step = 0; step < Math.min(5, settings.depth) && frontier.length; step++) {
      const next: string[] = []
      for (const id of frontier) for (const other of neighbors.get(id) || []) if (!local.has(other)) { local.add(other); next.push(other) }
      frontier = next
    }
  }
  let nodes = graph.nodes.filter((node) => (!local || local.has(node.id)) && (settings.tags || node.kind !== 'tag') && (settings.attachments || node.kind !== 'attachment') && (!settings.existingOnly || node.kind !== 'unresolved') && matchesGraphQuery(node, settings.query))
  const ids = new Set(nodes.map((node) => node.id))
  const edges = graph.edges.filter((edge) => ids.has(edge.source) && ids.has(edge.target))
  if (!settings.orphans) { const connected = new Set(edges.flatMap((edge) => [edge.source, edge.target])); nodes = nodes.filter((node) => connected.has(node.id)) }
  return { ...graph, nodes, edges }
}
