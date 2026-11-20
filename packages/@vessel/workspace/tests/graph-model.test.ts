import { expect, it } from 'vitest'
import { buildWorkspaceGraph, filterWorkspaceGraph, matchesGraphQuery } from '../src/graph/model'
import { defaultGraphSettings, type IndexedFile, type RawIndex } from '../src/graph/types'
const note = (path: string, links: string[] = [], tags: string[] = []): IndexedFile => ({ path, title: path.split('/').pop()!.replace(/\.md$/, ''), kind: 'note', links: links.map((target) => ({ target, wiki: true })), tags, modifiedMs: 0 })
const index = (files: IndexedFile[]): RawIndex => ({ version: 1, files, warnings: [], scanned: files.length, reused: 0, elapsedMs: 1 })
it('resolves relative, root, encoded, alias-free wikilink targets and ignores external/escaping links', () => {
 const graph = buildWorkspaceGraph(index([
  note('folder/a.md', ['b', '../中文%20文件.md#标题', '/folder/b.md', 'https://example.com', 'mailto:a@b.com', '../../../../outside', '#heading', '../assets/a.png']),
  note('folder/b.md'), note('elsewhere/b.md'), note('中文 文件.md'),
  { ...note('assets/a.png'), kind: 'attachment' }
 ]))
 expect(graph.edges.filter((edge) => edge.source === 'folder/a.md').map((edge) => edge.target)).toEqual(['folder/b.md', '中文 文件.md'])
 expect(graph.nodes.some((node) => node.kind === 'unresolved')).toBe(false)
})

it('excludes indexed and missing image references from nodes, edges and local neighborhoods', () => {
 const source = note('notes/a.md', ['b', '../assets/photo.PNG', '../assets/missing.webp', '../assets/vector%2Esvg#preview', '../assets/report.pdf'])
 source.links.push({ target: '../assets/photo.PNG?width=200', wiki: false })
 const graph = buildWorkspaceGraph(index([
  source, note('notes/b.md'),
  { ...note('assets/photo.PNG'), kind: 'attachment' },
  { ...note('assets/report.pdf'), kind: 'attachment' }
 ]))
 expect(graph.nodes.map((node) => node.id)).toEqual(['notes/a.md', 'notes/b.md', 'assets/report.pdf'])
 expect(graph.edges.map((edge) => edge.target)).toEqual(['notes/b.md', 'assets/report.pdf'])
 const local = filterWorkspaceGraph(graph, { ...defaultGraphSettings, attachments: true, local: true }, 'notes/a.md')
 expect(local.nodes.map((node) => node.id)).toEqual(['notes/a.md', 'notes/b.md', 'assets/report.pdf'])
 expect(local.edges).toHaveLength(2)
})
it('builds tags, missing nodes, incoming local depth, display toggles and orphans', () => {
 const graph = buildWorkspaceGraph(index([note('a.md', ['b', 'missing'], ['项目']), note('b.md', ['c']), note('c.md'), note('orphan.md')]))
 expect(graph.nodes.find((node) => node.id === 'tag:项目')?.kind).toBe('tag')
 expect(filterWorkspaceGraph(graph, { ...defaultGraphSettings, existingOnly: true, orphans: false }).nodes.map((node) => node.id)).toEqual(['a.md', 'b.md', 'c.md'])
 expect(filterWorkspaceGraph(graph, { ...defaultGraphSettings, local: true, depth: 1 }, 'b.md').nodes.map((node) => node.id)).toEqual(['a.md', 'b.md', 'c.md'])
 expect(filterWorkspaceGraph(graph, { ...defaultGraphSettings, local: true, depth: 1, incoming: false }, 'b.md').nodes.map((node) => node.id)).toEqual(['b.md', 'c.md'])
})
it('matches field queries, quoted paths, tags and exclusions', () => {
 const node = { id: 'notes/项目 文档.md', path: 'notes/项目 文档.md', label: '项目 文档', kind: 'note' as const, tags: ['开发/rust'] }
 expect(matchesGraphQuery(node, 'path:"notes/项目 文档" tag:rust -file:日报')).toBe(true)
 expect(matchesGraphQuery(node, '-tag:rust')).toBe(false)
})

it('keeps Markdown links relative and does not resolve missing root links to another folder', () => {
 const source = note('folder/a.md')
 source.links = [{ target: 'b.md', wiki: false }, { target: '/b.md', wiki: false }, { target: '../missing.md', wiki: false }]
 const graph = buildWorkspaceGraph(index([source, note('folder/b.md'), note('other/missing.md')]))
 expect(graph.edges.map((edge) => edge.target)).toEqual(['folder/b.md', 'missing:b.md', 'missing:missing.md'])
})
