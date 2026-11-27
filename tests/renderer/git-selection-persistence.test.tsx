import { act, cleanup, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import type { GitStatusResult } from '@vessel/type'
import { useGitRepository } from '@/pages/git/hooks/use-git-repository'
import { useGitSelectionState } from '@/pages/git/hooks/use-git-selection-state'
import { getGitFileSelection, reconcileGitFileSelection } from '@/pages/git/file-selection-state'
import { useGitFileSelection } from '@/pages/git/hooks/use-git-file-selection'
import { GitUnstagedFiles } from '@/pages/git/components/git-unstaged-files'
import type { GitPageModel } from '@/pages/git/hooks/use-git-page'
const status: GitStatusResult = { isRepo: true, branch: 'main', upstream: '', ahead: 0, behind: 0, staged: [], unstaged: [{ path: 'first.md', status: 'M' }, { path: 'chosen.md', status: 'M' }], untracked: [], conflicts: [] }
let root = ''
beforeEach(() => {
 root = '/selection-test/' + crypto.randomUUID()
 localStorage.setItem('vessel:git-current-repo', root)
 vi.stubGlobal('ResizeObserver', class { observe = vi.fn(); unobserve = vi.fn(); disconnect = vi.fn() })
 window.electronAPI = {
  ...window.electronAPI,
  getAppState: vi.fn(async () => []), onFilesChanged: vi.fn(() => vi.fn()), watchStart: vi.fn(async () => 'watch'), watchStop: vi.fn(async () => {}),
  git: {
   isRepo: vi.fn(async () => true), getStatus: vi.fn(async () => status), getBranches: vi.fn(async () => ({local:['main'],remote:[],current:'main'})),
   getLog: vi.fn(async () => []), getStashes: vi.fn(async () => []), getLogCount: vi.fn(async () => 0), getUnpushedCommits: vi.fn(async () => []),
   getRepositorySettings: vi.fn(async () => ({ templateMode: 'none', template: '' })), getDiff: vi.fn(async (_root, path) => ({diff:'diff:'+path}))
  }
 } as any
})
afterEach(() => { cleanup(); localStorage.clear(); vi.unstubAllGlobals() })
function Fixture() {
 const repo = useGitRepository(), selection = useGitFileSelection(repo)
 return <GitUnstagedFiles g={{ ...repo, ...selection } as GitPageModel} />
}
it('animates a repository switch only after its data arrives and leaves ordinary refreshes still', async () => {
 const transition = vi.fn((update: () => unknown) => {
  const done = Promise.resolve().then(update)
  return { updateCallbackDone: done, ready: done, finished: done, skipTransition: vi.fn() }
 })
 Object.defineProperty(document, 'startViewTransition', { configurable: true, value: transition })
 try {
  const page = renderHook(() => useGitRepository())
  await waitFor(() => expect(page.result.current.status).toBe(status))
  expect(transition).not.toHaveBeenCalled()
  let finish!: (value: GitStatusResult) => void
  const next = { ...status, branch: 'next-project' }
  vi.mocked(window.electronAPI.git.getStatus).mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
  act(() => page.result.current.setRepoPath(root + '/next'))
  await waitFor(() => expect(finish).toBeTypeOf('function'))
  expect(transition).not.toHaveBeenCalled()
  expect(page.result.current.status).toBe(status)
  await act(async () => { finish(next) })
  await waitFor(() => expect(page.result.current.status).toBe(next))
  expect(transition).toHaveBeenCalledTimes(1)
  await act(async () => { await page.result.current.refresh() })
  expect(transition).toHaveBeenCalledTimes(1)
 } finally {
  delete (document as Partial<Document>).startViewTransition
 }
})
it('restores the selected row and its diff after leaving and remounting the Git route', async () => {
 const result = render(<Fixture />)
 fireEvent.click(await screen.findByText('chosen.md'))
 expect(screen.getByText('chosen.md').closest('[data-git-file-selected]')?.getAttribute('data-git-file-selected')).toBe('true')
 result.unmount()
 const page = renderHook(() => useGitRepository())
 await waitFor(() => expect(page.result.current.status).not.toBeNull())
 expect(page.result.current.selectedFile?.path).toBe('chosen.md')
 expect(page.result.current.selectedUnstagedPaths).toEqual(['chosen.md'])
 await waitFor(() => expect(page.result.current.diffText).toBe('diff:chosen.md'))
 page.unmount()
 render(<Fixture />)
 await screen.findByText('chosen.md')
 const row = screen.getByText('chosen.md').closest<HTMLElement>('[data-git-file-selected]')!
 expect(row.getAttribute('data-git-file-selected')).toBe('true')
 row.scrollIntoView = vi.fn()
 await waitFor(() => expect(row.scrollIntoView).toHaveBeenCalledWith({ block: 'nearest', inline: 'nearest' }))
})
it('keeps multi-selection per repository and removes stale paths when files disappear', () => {
 const result = renderHook(({path}) => useGitSelectionState(path), {initialProps:{path:root}})
 act(() => {
  result.result.current.setSelectedFile(status.unstaged[1]); result.result.current.setSelectedUnstagedPaths(['first.md','chosen.md'])
 })
 result.rerender({path:root+'/other'})
 expect(result.result.current.selectedFile).toBeNull()
 act(() => { result.result.current.setSelectedStagedPaths(['other.md']) })
 result.rerender({path:root})
 expect(result.result.current.selectedUnstagedPaths).toEqual(['first.md','chosen.md'])
 act(() => reconcileGitFileSelection(root, {...status,unstaged:[status.unstaged[0]]}))
 expect(result.result.current.selectedUnstagedPaths).toEqual(['first.md'])
 expect(result.result.current.selectedFile?.path).toBe('first.md')
 act(() => reconcileGitFileSelection(root, {...status,unstaged:[]}))
 expect(result.result.current.selectedFile).toBeNull()
 expect(result.result.current.selectedUnstagedPaths).toEqual([])
})
it('retains working-tree selection when the same file is staged too, and follows it when staged', async () => {
 vi.mocked(window.electronAPI.git.getStatus).mockResolvedValue({...status,staged:[status.unstaged[1]]})
 const page = renderHook(() => useGitRepository())
 await waitFor(() => expect(page.result.current.status).not.toBeNull())
 act(() => {
  page.result.current.setSelectedFile(status.unstaged[1]); page.result.current.setSelectedUnstagedPaths(['chosen.md']); page.result.current.setActiveFileSection('unstaged')
 })
 await waitFor(() => expect(window.electronAPI.git.getDiff).toHaveBeenLastCalledWith(root,'chosen.md',false))
 page.unmount()
 const restored = renderHook(() => useGitRepository())
 await waitFor(() => expect(restored.result.current.diffText).toBe('diff:chosen.md'))
 expect(window.electronAPI.git.getDiff).toHaveBeenLastCalledWith(root,'chosen.md',false)
 act(() => reconcileGitFileSelection(root,{...status,staged:[status.unstaged[1]],unstaged:[]}))
 expect(getGitFileSelection(root).activeFileSection).toBe('staged')
 expect(getGitFileSelection(root).selectedStagedPaths).toEqual(['chosen.md'])
})

it('ignores an old diff response after a different file has been selected', async () => {
 let finish!: (value: {diff:string}) => void
 const old = new Promise<{diff:string}>((resolve) => { finish = resolve })
 vi.mocked(window.electronAPI.git.getDiff).mockImplementation(async (_root, path) => path === 'first.md' ? old : {diff:'current diff'})
 const page = renderHook(() => useGitRepository())
 await waitFor(() => expect(window.electronAPI.git.getDiff).toHaveBeenCalledWith(root,'first.md',false))
 act(() => { page.result.current.setSelectedFile(status.unstaged[1]); page.result.current.setSelectedUnstagedPaths(['chosen.md']) })
 await waitFor(() => expect(page.result.current.diffText).toBe('current diff'))
 await act(async () => { finish({diff:'stale diff'}); await old })
 expect(page.result.current.diffText).toBe('current diff')
})

it('limits Shift selection and select-all to visible filtered files', async () => {
 const files = [{path:'keep-one.ts',status:'M'}, {path:'hidden.ts',status:'M'}, {path:'keep-two.ts',status:'M'}]
 vi.mocked(window.electronAPI.git.getStatus).mockResolvedValue({...status,unstaged:files})
 const page = renderHook(() => {
  const repo = useGitRepository()
  return {...repo,...useGitFileSelection(repo,'keep')}
 })
 await waitFor(() => expect(page.result.current.status?.unstaged).toHaveLength(3))
 act(() => page.result.current.handleUnstagedItemClick({shiftKey:false} as any,files[0],0))
 act(() => page.result.current.handleUnstagedItemClick({shiftKey:true} as any,files[2],2))
 expect(page.result.current.selectedUnstagedPaths).toEqual(['keep-one.ts','keep-two.ts'])
 act(() => window.dispatchEvent(new KeyboardEvent('keydown',{key:'a',ctrlKey:true,bubbles:true})))
 expect(page.result.current.selectedUnstagedPaths).toEqual(['keep-one.ts','keep-two.ts'])
 page.unmount()
})

it('selects Git tree ranges in visible sorted order and supports keyboard multi-selection', async () => {
 localStorage.setItem('git-unstaged-tree-view', 'true')
 const files = [{path:'a/z.ts',status:'M'},{path:'b/c.ts',status:'M'},{path:'a/a.ts',status:'M'}]
 vi.mocked(window.electronAPI.git.getStatus).mockResolvedValue({...status,unstaged:files} as GitStatusResult)
 render(<Fixture />)
 await screen.findByText('z.ts')
 const row = (name: string) => screen.getByText(name).closest<HTMLElement>('[data-git-change-path]')!
 const selected = () => [...document.querySelectorAll<HTMLElement>('[data-git-file-selected="true"]')].map(row => row.dataset.gitChangePath)
 fireEvent.click(row('a.ts'))
 fireEvent.click(row('z.ts'),{shiftKey:true})
 expect(selected()).toEqual(['a/a.ts','a/z.ts'])
 fireEvent.keyDown(row('z.ts'),{key:'ArrowDown',shiftKey:true})
 expect(selected()).toEqual(['a/a.ts','a/z.ts','b/c.ts'])
 expect(document.activeElement).toBe(row('c.ts'))
 fireEvent.keyDown(row('c.ts'),{key:'ArrowUp',shiftKey:true})
 expect(selected()).toEqual(['a/a.ts','a/z.ts'])
 fireEvent.keyDown(row('z.ts'),{key:'ArrowDown',ctrlKey:true})
 expect(document.activeElement).toBe(row('c.ts'))
 expect(selected()).toEqual(['a/a.ts','a/z.ts'])
 fireEvent.keyDown(row('c.ts'),{key:' ',ctrlKey:true})
 expect(selected()).toEqual(['a/a.ts','a/z.ts','b/c.ts'])
 fireEvent.click(screen.getByRole('button',{name:'收起目录 a'}))
 fireEvent.keyDown(row('c.ts'),{key:'a',metaKey:true})
 expect(selected()).toEqual(['b/c.ts'])
})


it('keeps the explicitly chosen Git repository when the resource project changes, including after remount', async () => {
 const page = renderHook(() => useGitRepository())
 await waitFor(() => expect(page.result.current.status).not.toBeNull())
 vi.mocked(window.electronAPI.getAppState).mockResolvedValue([{name:'Other',path:'/other'}])
 act(() => {
  localStorage.setItem('resource_current_project', JSON.stringify({name:'Other',path:'/other'}))
  window.dispatchEvent(new Event('vessel:resource-changed'))
 })
 await waitFor(() => expect(page.result.current.libraryProjects).toEqual([{name:'Other',path:'/other'}]))
 expect(page.result.current.repoPath).toBe(root)
 expect(localStorage.getItem('vessel:git-current-repo')).toBe(root)
 page.unmount()
 const restored = renderHook(() => useGitRepository())
 expect(restored.result.current.repoPath).toBe(root)
 act(() => { restored.result.current.setRepoPath('/explicit-git') })
 await waitFor(() => expect(localStorage.getItem('vessel:git-current-repo')).toBe('/explicit-git'))
 expect(JSON.parse(localStorage.getItem('resource_current_project')!).path).toBe('/other')
})
