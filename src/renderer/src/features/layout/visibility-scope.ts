type Scope = 'todos' | 'graph' | 'devtools'

export function layoutScopeForPath(path: string): Scope | null {
  if (path === '/editor/graph') return 'graph'
  if (/^\/todos(\/|$)/.test(path)) return 'todos'
  if (/^\/devtools(\/|$)/.test(path)) return 'devtools'
  return null
}
