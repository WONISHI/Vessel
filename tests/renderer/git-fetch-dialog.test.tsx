import { act, cleanup, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { FetchDialog } from '@/pages/git/components/fetch-dialog'
import { useGitCommitActions } from '@/pages/git/hooks/use-git-commit-actions'
vi.mock('@vessel/react-router', () => ({ useRouter: () => ({ push: vi.fn() }) }))
beforeEach(() => {
 vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} })
 HTMLElement.prototype.scrollIntoView = vi.fn()
 window.electronAPI = { ...window.electronAPI, git: { ...window.electronAPI?.git, getPushInfo: vi.fn(async () => ({remotes:[{name:'origin',url:'/remote.git'}],remoteBranches:[],branches:[]})) } }
})
afterEach(() => { cleanup(); vi.unstubAllGlobals() })
it('defaults to all remotes and submits prune/tags only after confirmation', async () => {
 let finish!: () => void
 const onFetch = vi.fn(() => new Promise<void>((resolve) => { finish = resolve })), onClose = vi.fn()
 render(<FetchDialog repoPath="/repo" onFetch={onFetch} onClose={onClose} />)
 await waitFor(() => expect((screen.getByRole('button',{name:'确定'}) as HTMLButtonElement).disabled).toBe(false))
 expect(screen.getByLabelText('抓取所有远端更新').getAttribute('data-state')).toBe('checked')
 expect(onFetch).not.toHaveBeenCalled()
 fireEvent.click(screen.getByLabelText('删除远端已不存在的跟踪分支'))
 fireEvent.click(screen.getByLabelText('抓取并在本地存储所有标签'))
 fireEvent.click(screen.getByRole('button',{name:'确定'}))
 expect(onFetch).toHaveBeenCalledWith({remote:'origin',all:true,prune:true,tags:true})
 expect(await screen.findByRole('status')).toHaveProperty('textContent',expect.stringContaining('正在抓取'))
 await act(async () => finish())
 expect(onClose).toHaveBeenCalledOnce()
})
it('preselects a context-menu remote and cancels without fetching', async () => {
 const onFetch = vi.fn(), onClose = vi.fn()
 render(<FetchDialog repoPath="/repo" initialRemote="origin" onFetch={onFetch} onClose={onClose} />)
 await waitFor(() => expect(screen.getByLabelText('抓取远程仓库').textContent).toBe('origin'))
 expect(screen.getByLabelText('抓取所有远端更新').getAttribute('data-state')).toBe('unchecked')
 fireEvent.click(screen.getByRole('button',{name:'取消'}))
 expect(onClose).toHaveBeenCalledOnce(); expect(onFetch).not.toHaveBeenCalled()
})
it('opens a request without fetching and passes confirmed options to the API', async () => {
 const fetch = vi.fn(async () => {})
 window.electronAPI.git.fetch = fetch
 const repo = {repoPath:'/repo',remotePending:{current:false},setLoading:vi.fn(),setRemoteOperation:vi.fn(),refresh:vi.fn(async () => {})}
 const hook = renderHook(() => useGitCommitActions(repo as any,async () => true))
 act(() => hook.result.current.handleFetch('origin'))
 expect(hook.result.current.fetchRequest).toEqual({repoPath:'/repo',remote:'origin'})
 expect(fetch).not.toHaveBeenCalled()
 await act(async () => hook.result.current.submitFetch({remote:'origin',all:false,prune:true,tags:false}))
 expect(fetch).toHaveBeenCalledExactlyOnceWith('/repo','origin',{all:false,prune:true,tags:false})
 expect(repo.setRemoteOperation.mock.calls).toEqual([['fetch'],[null]])
})
