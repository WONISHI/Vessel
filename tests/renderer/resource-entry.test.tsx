import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { ResourceRoute } from '@/pages/resources'
import { projectCache } from '@/components/workspace/components/layout-aside/project-library/components/project-library-shared'

vi.mock('@/components/layout/activity-bar/index', () => ({ default: () => null }))
vi.mock('@/components/layout/index', () => ({ default: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }))
vi.mock('@/components/workspace/index', () => ({ default: ({ workspace }: { workspace: { name: string } }) => <main>{workspace.name} 项目工作台</main> }))
vi.mock('@/components/workspace/components/layout-aside/project-library/components/project-preview', () => ({ ProjectPreview: () => <div>项目目录预览</div> }))
const project = { name: 'Vessel', path: '/projects/Vessel' }
beforeEach(() => { localStorage.clear(); projectCache.projects = null })
afterEach(() => { cleanup(); localStorage.clear(); projectCache.projects = null; vi.unstubAllGlobals() })
const show = () => render(<MemoryRouter initialEntries={['/resources']}><ResourceRoute /></MemoryRouter>)

it('restores projects from the authenticated domain when renderer selection caches are empty', async () => {
  let finish!: (value: unknown) => void
  const pending = new Promise(resolve => { finish = resolve })
  vi.stubGlobal('electronAPI', { getAppState: vi.fn(() => pending) })
  show()
  expect(screen.getByRole('status')).toBeTruthy()
  expect(screen.queryByText('开始使用')).toBeNull()
  await act(async () => { finish([project]); await pending })
  expect(await screen.findByText('Vessel 项目工作台')).toBeTruthy()
  expect(JSON.parse(localStorage.getItem('resource_current_project')!)).toMatchObject(project)
})

it('shows the library empty state and opens a newly added project instead of the workspace welcome page', async () => {
  const setAppState = vi.fn().mockResolvedValue(undefined)
  vi.stubGlobal('electronAPI', { getAppState: vi.fn().mockResolvedValue([]), setAppState, openDirectory: vi.fn().mockResolvedValue(project) })
  show()
  expect(await screen.findByText('还没有项目目录')).toBeTruthy()
  expect(screen.queryByText('开始使用')).toBeNull()
  fireEvent.click(screen.getByRole('button', { name: '添加项目目录' }))
  expect(await screen.findByText('Vessel 项目工作台')).toBeTruthy()
  expect(setAppState).toHaveBeenCalledWith('project-library', [project])
})

it('treats malformed selection caches as absent and never substitutes the editor workspace', async () => {
  localStorage.setItem('resource_current_project', 'invalid json')
  localStorage.setItem('app_current_workspace', JSON.stringify({ name: 'Private notes', path: '/notes' }))
  vi.stubGlobal('electronAPI', { getAppState: vi.fn().mockResolvedValue([]) })
  show()
  expect(await screen.findByText('还没有项目目录')).toBeTruthy()
  expect(screen.queryByText('Private notes 项目工作台')).toBeNull()
})
