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
