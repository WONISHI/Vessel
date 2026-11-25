import { cleanup, fireEvent, render, screen } from "@testing-library/react"
import { afterEach, expect, it, vi } from "vitest"
import { GitToolbar } from "@/pages/git/components/git-toolbar"
import type { GitPageModel } from "@/pages/git/hooks/use-git-page"
vi.mock("@vessel/react-router", () => ({ useRouter: () => ({ push: vi.fn() }) }))
afterEach(() => { cleanup(); vi.unstubAllGlobals() })
it.each([3, 20])("uses ScrollArea with an eight-project height limit for %i projects", async count => {
 vi.stubGlobal("ResizeObserver", class { observe = vi.fn(); unobserve = vi.fn(); disconnect = vi.fn() })
 const setRepoPath = vi.fn()
 const projects = Array.from({length:count},(_,index)=>({name:`Project ${index}`,path:`/project/${index}`}))
 const g = {repoPath:"/project/0",libraryProjects:projects,remoteOperation:null,status:null,stashes:[],setRepoPath} as unknown as GitPageModel
 render(<GitToolbar g={g}/> )
 fireEvent.keyDown(screen.getByRole("button",{name:"Project 0"}),{key:"Enter"})
 const area = await screen.findByLabelText("Git 项目列表")
 expect(area.getAttribute("data-vessel-scroll")).toBe("area")
 expect(area.style.height).toBe(`${Math.min(count,8)*28}px`)
 expect(area.querySelector('[data-radix-scroll-area-viewport]')).toBeTruthy()
 expect(screen.getAllByRole("menuitemradio")).toHaveLength(count)
 fireEvent.click(screen.getByRole("menuitemradio",{name:`Project ${count-1}`}))
 expect(setRepoPath).toHaveBeenCalledWith(`/project/${count-1}`)
})
