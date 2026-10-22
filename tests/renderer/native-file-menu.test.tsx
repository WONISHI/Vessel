import { act, cleanup, render, waitFor } from "@testing-library/react"
import { afterEach, expect, it, vi } from "vitest"
import { NativeFileMenu } from "@/components/native-file-menu"
import { markdownDocuments } from "@/components/native-file-menu/document-bridge"
import type { NativeMenuAPI } from "@vessel/type"
vi.mock("@vessel/react-router", () => ({ useRouter: () => ({ push: vi.fn() }) }))
vi.mock("react-router-dom", () => ({ useLocation: () => ({ pathname: "/editor/file", key: "test" }) }))

afterEach(() => { cleanup(); markdownDocuments.clear(); vi.unstubAllGlobals() })

it("saves and exports the live draft and closes the active tab", async () => {
  window.location.hash = "#/editor/file"
  const closeFile = vi.fn()
  const provide = (event: Event) => (event as CustomEvent).detail({ root: "/notes", activePath: "/notes/test.md", files: [], openFile: vi.fn(), closeFile })
  window.addEventListener("vessel:request-workspace-files", provide)
  markdownDocuments.set("/notes/test.md", { content: () => "unsaved draft", html: () => "<html>draft</html>" })
  let command!: Parameters<NativeMenuAPI["onFileMenuCommand"]>[0]
  const saveContent = vi.fn().mockResolvedValue(undefined)
  const updateFileMenu = vi.fn()
  const fileMenuDialog = vi.fn().mockResolvedValue("/notes/export.pdf")
  vi.stubGlobal("electronAPI", {
    onFileMenuCommand: (callback: typeof command) => { command = callback; return vi.fn() },
    updateFileMenu, fileMenuDialog, saveContent, setAppState: vi.fn().mockResolvedValue(undefined),
    getAppState: vi.fn().mockResolvedValue([]), getRecentWorkspaces: vi.fn().mockResolvedValue([])
  })
  try {
    render(<NativeFileMenu />)
    await waitFor(() => expect(updateFileMenu).toHaveBeenCalledWith(expect.objectContaining({ canSave: true, canExport: true })))
    act(() => command("save"))
    await waitFor(() => expect(saveContent).toHaveBeenCalledWith("/notes/test.md", "unsaved draft"))
    await act(async () => { await Promise.resolve() })
    act(() => command("export-pdf"))
    await waitFor(() => expect(fileMenuDialog).toHaveBeenCalledWith({ action: "pdf", defaultPath: "/notes/test.pdf", html: "<html>draft</html>" }))
    await act(async () => { await Promise.resolve() })
    act(() => command("close-tab"))
    expect(closeFile).toHaveBeenCalledWith("/notes/test.md")
  } finally { window.removeEventListener("vessel:request-workspace-files", provide) }
})
