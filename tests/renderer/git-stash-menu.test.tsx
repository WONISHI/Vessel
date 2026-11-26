import { useState } from "react"
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, expect, it, vi } from "vitest"
import { GitStagedFiles } from "@/pages/git/components/git-staged-files"
import { GitUnstagedFiles } from "@/pages/git/components/git-unstaged-files"
import { StashDialog } from "@/pages/git/components/stash-dialog"
import type { StashRequest } from "@/pages/git/hooks/use-git-file-actions"
import type { GitPageModel } from "@/pages/git/hooks/use-git-page"

afterEach(() => { cleanup(); vi.unstubAllGlobals() })
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
