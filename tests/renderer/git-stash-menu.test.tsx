import { useState } from "react"
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, expect, it, vi } from "vitest"
import { GitStagedFiles } from "@/pages/git/components/git-staged-files"
import { GitUnstagedFiles } from "@/pages/git/components/git-unstaged-files"
import { StashDialog } from "@/pages/git/components/stash-dialog"
import type { StashRequest } from "@/pages/git/hooks/use-git-file-actions"
import type { GitPageModel } from "@/pages/git/hooks/use-git-page"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { useGitFileActions } from "@/pages/git/hooks/use-git-file-actions"

afterEach(() => { cleanup(); vi.unstubAllGlobals() })
it.each([['staged', 1], ['staged', 2], ['unstaged', 1], ['unstaged', 2]] as const)("keeps %s discard confirmation open for %i files until an explicit choice", async (section, count) => {
  vi.stubGlobal("ResizeObserver", class { observe = vi.fn(); unobserve = vi.fn(); disconnect = vi.fn() })
  const discard = vi.fn().mockResolvedValue(undefined)
  const unstage = vi.fn().mockResolvedValue(undefined)
  vi.stubGlobal('electronAPI', { git: { discard, unstage } })
  const files = [{ path: 'one.ts', status: 'M' }, { path: 'two.ts', status: 'M' }]
  function App() {
    const status = { staged: files, unstaged: files, untracked: [], conflicts: [] }
    const actions = useGitFileActions({ repoPath: '/repo', status, refresh: async () => {} } as any)
    const paths = files.slice(0, count).map(file => file.path)
    const g = { ...actions, repoPath: '/repo', status, selectedStagedPaths: paths, selectedUnstagedPaths: paths, handleStagedContextMenu: () => {}, handleUnstagedContextMenu: () => {} } as unknown as GitPageModel
    return <>{section === 'staged' ? <GitStagedFiles g={g} /> : <GitUnstagedFiles g={g} />}<ConfirmDialog activityBarAccessible open={!!actions.confirmation} onOpenChange={open => { if (!open) actions.settleConfirmation(false) }} title="确认操作" description={actions.confirmation} confirmText="确认" onConfirm={() => actions.settleConfirmation(true)} /></>
  }
  render(<App />)
  const open = async () => {
    fireEvent.contextMenu(screen.getByText('one.ts'), { clientX: 20, clientY: 20 })
    fireEvent.click(screen.getByRole('menuitem', { name: /放弃/ }))
    await waitFor(() => expect(screen.queryByRole('menu')).toBeNull())
    expect(await screen.findByRole('dialog')).toBeTruthy()
  }
  await open()
  expect(discard).not.toHaveBeenCalled()
  expect(unstage).not.toHaveBeenCalled()
  fireEvent.click(screen.getByRole('button', { name: '取消', exact: true }))
  expect(discard).not.toHaveBeenCalled()
  await open()
  fireEvent.click(screen.getByRole('button', { name: '确认', exact: true }))
  await waitFor(() => expect(discard).toHaveBeenCalledWith('/repo', files.slice(0, count).map(file => file.path), false))
  if (section === 'staged') expect(unstage).toHaveBeenCalled()
  else expect(unstage).not.toHaveBeenCalled()
})
it.each(["staged", "unstaged"])("keeps the stash dialog open after selecting from the %s context menu", async section => {
  vi.stubGlobal("ResizeObserver", class { observe = vi.fn(); unobserve = vi.fn(); disconnect = vi.fn() })
  const submit = vi.fn().mockResolvedValue(undefined)
  const files = [{path:"one.ts",status:"M"},{path:"two.ts",status:"M"}]
  function App() {
    const [request, setRequest] = useState<StashRequest | null>(null)
    const paths = files.map(file => file.path)
    const g = {repoPath:"/repo",status:{staged:files,unstaged:files,untracked:[],conflicts:[]},selectedStagedPaths:paths,selectedUnstagedPaths:paths,
      handleStagedContextMenu:()=>{},handleUnstagedContextMenu:()=>{},
      handleStashFiles:(paths: string[])=>setRequest({paths})} as unknown as GitPageModel
    return <>{section === "staged" ? <GitStagedFiles g={g}/> : <GitUnstagedFiles g={g}/>}{request && <StashDialog request={request} onClose={()=>setRequest(null)} onSubmit={submit}/>}</>
  }
  render(<App />)
  fireEvent.contextMenu(screen.getByText("one.ts"),{clientX:20,clientY:20})
  fireEvent.click(screen.getByRole("menuitem",{name:"贮藏选中的 2 个文件…"}))
  await waitFor(()=>expect(screen.getByRole("dialog")).toBeTruthy())
  await waitFor(()=>expect(screen.queryByRole("menu")).toBeNull())
  expect(screen.getByRole("dialog")).toBeTruthy()
  expect(submit).not.toHaveBeenCalled()
  expect((screen.getByLabelText("说明") as HTMLInputElement).value).toBe("")
  fireEvent.click(screen.getByRole("button", { name: "贮藏", exact: true }))
  await waitFor(() => expect(submit).toHaveBeenCalledWith("", false))
})
