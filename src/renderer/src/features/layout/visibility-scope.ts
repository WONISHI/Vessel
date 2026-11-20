type Scope = 'todos' | 'graph' | 'devtools'
type Visibility = { activityCollapsed: boolean; statusVisible: boolean }
let scope: Scope | null = null
let override: Visibility = { activityCollapsed: false, statusVisible: true }
const listeners = new Set<() => void>()
export function subscribeLayoutScope(listener: () => void) {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}
export function getLayoutOverride() { return scope ? override : null }
/** Feature views use temporary defaults without changing the saved workspace layout. */
export function setLayoutScope(next: Scope | null, reset = false) {
  if (scope === next && !reset) return
  scope = next
  override = { activityCollapsed: false, statusVisible: true }
  listeners.forEach(listener => listener())
}
export function updateLayoutOverride(value: Partial<Visibility>) {
  if (!scope) return false
  override = { ...override, ...value }
  listeners.forEach(listener => listener())
  return true
}
export function layoutScopeForPath(path: string): Scope | null {
  if (path === '/editor/graph') return 'graph'
  if (/^\/todos(\/|$)/.test(path)) return 'todos'
  if (/^\/devtools(\/|$)/.test(path)) return 'devtools'
  return null
}
