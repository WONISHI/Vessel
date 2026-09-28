import React from "react"
import {act,cleanup,render,screen,waitFor} from "@testing-library/react"
import {afterEach,expect,it,vi} from "vitest"
const state=vi.hoisted(()=>({after:undefined as undefined|(()=>void),created:vi.fn(),destroy:vi.fn()}))
vi.mock("vditor",()=>({default:class{constructor(_element:HTMLElement,options:{after:()=>void}){state.created();state.after=options.after}destroy(){state.destroy()}}}))
import {VditorEditor} from "../../src/renderer/src/components/core/canvas/variants/markdown/vditor-editor"
afterEach(cleanup)
it("paints document loading before initialization and dismisses it only when the editor is ready",async()=>{
 render(<VditorEditor value="# 文档" onChange={()=>{}} workspacePath="/notes" documentPath="/notes/test.md"/>)
 expect(screen.getByRole("status").textContent).toContain("正在解析")
 expect(state.created).not.toHaveBeenCalled()
 await waitFor(()=>expect(state.created).toHaveBeenCalledTimes(1))
 expect(screen.getByRole("status")).toBeTruthy()
 act(()=>state.after?.())
 await waitFor(()=>expect(screen.queryByRole("status")).toBeNull())
})
