import { useState } from "react"
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, expect, it, vi } from "vitest"
import { ResourceRoute } from "@/pages/resources"
import { openResourceProject } from "@/pages/resources/open-project"
import { TerminalPanel } from "@/components/workspace/components/layout-main/terminal-panel"
import { disposeTerminalSession } from "@/components/workspace/components/layout-main/terminal-session"

const mock = vi.hoisted(() => ({ terminals: [] as { writes: string[] }[] }))
vi.mock("@xterm/xterm", () => ({ Terminal: class {
 options = {}; cols = 80; rows = 24; writes: string[] = []
 constructor() { mock.terminals.push(this) }
 loadAddon = vi.fn(); open = vi.fn(); focus = vi.fn(); refresh = vi.fn(); dispose = vi.fn()
 write(text: string) { this.writes.push(text) }
 onData() { return { dispose: vi.fn() } }
} }))
vi.mock("@xterm/addon-fit", () => ({ FitAddon: class { fit = vi.fn() } }))
vi.mock("@/components/workspace/index", () => ({ default: function Project({ workspace }: { workspace: { name: string; path: string } }) {
 const [draft, setDraft] = useState("")
 return <section aria-label={workspace.name}><input aria-label={`${workspace.name} draft`} value={draft} onChange={event => setDraft(event.target.value)} /><TerminalPanel root={workspace.path}/></section>
} }))
vi.mock("@/components/workspace-welcome/index", () => ({ default: () => <div>选择项目</div> }))
afterEach(() => { cleanup(); disposeTerminalSession("/sessions/A", 1); disposeTerminalSession("/sessions/B", 1); localStorage.clear(); sessionStorage.clear(); vi.unstubAllGlobals() })
it("keeps independent drafts and running terminal output across project switches", async () => {
 localStorage.clear(); sessionStorage.clear()
 vi.stubGlobal("ResizeObserver", class { observe = vi.fn(); disconnect = vi.fn() })
 const listeners = new Set<(id: string, data: string) => void>()
 const close = vi.fn().mockResolvedValue(undefined)
 const start = vi.fn(async (root: string) => ({ id: root, cwd: root }))
 vi.stubGlobal("electronAPI", { getAppState: vi.fn().mockResolvedValue([]), setAppState: vi.fn().mockResolvedValue(undefined), terminalStart: start, terminalClose: close, terminalResize: vi.fn().mockResolvedValue(undefined), onTerminalData: (listener: (id: string, data: string) => void) => { listeners.add(listener); return () => listeners.delete(listener) } })
 render(<ResourceRoute />)
 expect(screen.getByText("选择项目")).toBeTruthy()
 await act(async () => { await openResourceProject({ name: "A", path: "/sessions/A" }) })
 await waitFor(() => expect(start).toHaveBeenCalledTimes(1))
 const draftA = screen.getByRole("textbox", { name: "A draft" })
 fireEvent.change(draftA, { target: { value: "unsaved A" } })
 await act(async () => { await openResourceProject({ name: "B", path: "/sessions/B" }) })
 await waitFor(() => expect(start).toHaveBeenCalledTimes(2))
 const draftB = screen.getByRole("textbox", { name: "B draft" })
 fireEvent.change(draftB, { target: { value: "unsaved B" } })
 act(() => listeners.forEach(listener => { listener("/sessions/A", "A background output"); listener("/sessions/B", "B foreground output") }))
 expect(mock.terminals[0].writes).toEqual(["A background output"])
 expect(mock.terminals[1].writes).toEqual(["B foreground output"])
 await act(async () => { await openResourceProject({ name: "A", path: "/sessions/A" }) })
 expect(screen.getByRole("textbox", { name: "A draft" })).toBe(draftA)
 expect((draftA as HTMLInputElement).value).toBe("unsaved A")
 await act(async () => { await openResourceProject({ name: "B", path: "/sessions/B" }) })
 expect(screen.getByRole("textbox", { name: "B draft" })).toBe(draftB)
 expect((draftB as HTMLInputElement).value).toBe("unsaved B")
 expect(start).toHaveBeenCalledTimes(2)
 expect(close).not.toHaveBeenCalled()
})
