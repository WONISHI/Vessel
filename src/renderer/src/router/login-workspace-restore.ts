import type { WorkspaceData } from '@vessel/type'

/** Resolve the authenticated domain before creating the router, retaining the boot loading UI. */
export async function restoreLoginWorkspace(): Promise<void> {
  const url = new URL(window.location.href)
  if (!['', '#', '#/'].includes(url.hash) || !url.searchParams.has('dataDomain')) return
  try {
    const workspace = await window.electronAPI.getAppState<WorkspaceData>('workspace-last')
      ?? await window.electronAPI.getAppState<WorkspaceData>('welcome:lastWorkspace')
    if (typeof workspace?.path !== 'string' || !workspace.path.trim()) return
    localStorage.setItem('app_current_workspace', JSON.stringify(workspace))
    url.hash = '#/editor'
    window.history.replaceState(window.history.state, '', url.href)
  } catch (error) {
    console.error('恢复登录域工作区失败', error)
  }
}
