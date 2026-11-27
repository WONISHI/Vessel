import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { openResourceProject } from '@/pages/resources/open-project'
import { rememberOpenedResourceProject } from '@/pages/resources/opened-projects'
import { projectCache } from '@/components/workspace/components/layout-aside/project-library/components/project-library-shared'

const project = { name: 'Example', path: '/projects/example' }
beforeEach(() => {
  localStorage.clear(); sessionStorage.clear(); projectCache.projects = null
  window.electronAPI = { getAppState: vi.fn(), setAppState: vi.fn() } as unknown as typeof window.electronAPI
})
afterEach(() => { localStorage.clear(); sessionStorage.clear(); projectCache.projects = null; vi.restoreAllMocks() })

it.each(['opened', 'cached'])('activates an %s project synchronously without waiting on database I/O', async source => {
  const changed = vi.fn()
  window.addEventListener('vessel:resource-changed', changed)
  vi.mocked(window.electronAPI.getAppState).mockImplementation(() => new Promise(() => {}))
  vi.mocked(window.electronAPI.setAppState).mockImplementation(() => new Promise(() => {}))
  if (source === 'opened') rememberOpenedResourceProject(project)
  else projectCache.projects = [project]
  try {
    const result = openResourceProject(project)
    expect(JSON.parse(localStorage.getItem('resource_current_project')!)).toEqual({ ...project, files: [] })
    expect(changed).toHaveBeenCalledOnce()
    expect(window.electronAPI.getAppState).not.toHaveBeenCalled()
    expect(window.electronAPI.setAppState).not.toHaveBeenCalled()
    await result
  } finally { window.removeEventListener('vessel:resource-changed', changed) }
})

it('loads an uncached library once and avoids writing an already registered project', async () => {
  vi.mocked(window.electronAPI.getAppState).mockResolvedValue([project])
  await openResourceProject(project)
  await openResourceProject(project)
  expect(window.electronAPI.getAppState).toHaveBeenCalledOnce()
  expect(window.electronAPI.setAppState).not.toHaveBeenCalled()
  expect(projectCache.projects).toEqual([project])
})

it('still persists a newly added project and keeps the current project if that fails', async () => {
  const current = { name: 'Current', path: '/current', files: [] }
  localStorage.setItem('resource_current_project', JSON.stringify(current))
  vi.mocked(window.electronAPI.getAppState).mockResolvedValue([current])
  vi.mocked(window.electronAPI.setAppState).mockRejectedValueOnce(new Error('offline'))
  await expect(openResourceProject(project)).rejects.toThrow('offline')
  expect(JSON.parse(localStorage.getItem('resource_current_project')!)).toEqual(current)
  vi.mocked(window.electronAPI.setAppState).mockResolvedValue(undefined)
  await openResourceProject(project)
  expect(window.electronAPI.setAppState).toHaveBeenLastCalledWith('project-library', [current, project])
  expect(JSON.parse(localStorage.getItem('resource_current_project')!).path).toBe(project.path)
})
