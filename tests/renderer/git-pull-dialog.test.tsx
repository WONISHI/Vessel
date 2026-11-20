import { act, cleanup, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { PullDialog } from '@/pages/git/components/pull-dialog'
import { useGitCommitActions } from '@/pages/git/hooks/use-git-commit-actions'
vi.mock('@vessel/react-router', () => ({ useRouter: () => ({ push: vi.fn() }) }))
beforeEach(() => {
 vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} })
 HTMLElement.prototype.scrollIntoView = vi.fn()
 window.electronAPI = { ...window.electronAPI, git: { ...window.electronAPI?.git, getPushInfo: vi.fn(async () => ({ remotes: [{name:'origin',url:'/remote.git'}], remoteBranches:['origin/main','origin/dev'], branches:[{name:'main',current:true,upstreamRemote:'origin',upstreamBranch:'main'}] })) } }
})
afterEach(() => { cleanup(); vi.unstubAllGlobals() })
it('selects the upstream by default and only submits after confirmation, then shows progress', async () => {
 let finish!: () => void
 const onPull = vi.fn(() => new Promise<void>((resolve) => { finish = resolve })), onClose = vi.fn()
 render(<PullDialog repoPath="/repo" onPull={onPull} onClose={onClose} />)
 await waitFor(() => expect(screen.getByLabelText('要拉取的远程分支').textContent).toBe('main'))
 expect(onPull).not.toHaveBeenCalled()
 fireEvent.keyDown(screen.getByLabelText('要拉取的远程分支'), {key:'ArrowDown'})
 fireEvent.click(await screen.findByRole('option',{name:'dev'}))
 fireEvent.click(screen.getByLabelText('使用变基代替合并'))
 expect((screen.getByLabelText('立即提交合并的改动') as HTMLButtonElement).disabled).toBe(true)
 fireEvent.click(screen.getByRole('button',{name:'确定'}))
 expect(onPull).toHaveBeenCalledWith({remote:'origin',branch:'dev',options:{commit:true,log:false,noFastForward:false,rebase:true}})
 expect(await screen.findByRole('status')).toHaveProperty('textContent',expect.stringContaining('正在拉取'))
 await act(async () => finish())
 expect(onClose).toHaveBeenCalledOnce()
})
it('opens the request without pulling and passes the confirmed options through the hook', async () => {
 const pull = vi.fn(async () => ({output:''}))
 window.electronAPI.git.pull = pull
 const repo = {repoPath:'/repo',remotePending:{current:false},setLoading:vi.fn(),setRemoteOperation:vi.fn(),refresh:vi.fn(async () => {})}
 const hook = renderHook(() => useGitCommitActions(repo as any, async () => true))
 act(() => hook.result.current.handlePull('origin','dev'))
 expect(hook.result.current.pullRequest).toEqual({repoPath:'/repo',remote:'origin',branch:'dev'})
 expect(pull).not.toHaveBeenCalled()
 const options = {commit:false,log:true,noFastForward:true,rebase:false}
 await act(async () => hook.result.current.submitPull({remote:'origin',branch:'dev',options}))
 expect(pull).toHaveBeenCalledExactlyOnceWith('/repo','origin','dev',options)
 expect(repo.setRemoteOperation.mock.calls).toEqual([['pull'],[null]])
})
it('cancels without invoking a pull', async () => {
 const onPull = vi.fn(), onClose = vi.fn()
 render(<PullDialog repoPath="/repo" onPull={onPull} onClose={onClose} />)
 await screen.findByText('main',{selector:'strong'})
 fireEvent.click(screen.getByRole('button',{name:'取消'}))
 expect(onClose).toHaveBeenCalledOnce()
 expect(onPull).not.toHaveBeenCalled()
})
