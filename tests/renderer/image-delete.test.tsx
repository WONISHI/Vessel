import { cleanup, render } from "@testing-library/react"
import { afterEach, expect, it, vi } from "vitest"
const state = vi.hoisted(() => ({ props: {} as any }))
vi.mock("@/components/ui/image", () => ({ Image: (props: any) => { state.props = props; return null } }))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
import { ObsidianImage } from "@/components/core/canvas/variants/markdown/obsidian-images/components/obsidian-image"
afterEach(cleanup)
it("removes the reference only after confirmed file deletion succeeds", async () => {
  const remove = vi.fn().mockResolvedValueOnce(false).mockRejectedValueOnce(new Error("denied")).mockResolvedValueOnce(true)
  window.electronAPI = { deleteObsidianImage: remove } as any
  const change = vi.fn()
  render(<ObsidianImage reference="![[a.png]]" root="/vault" documentPath="/vault/doc.md" onChange={change} />)
  await state.props.onDeleteFile()
  expect(change).not.toHaveBeenCalled()
  await expect(state.props.onDeleteFile()).rejects.toThrow("denied")
  expect(change).not.toHaveBeenCalled()
  await state.props.onDeleteFile()
  expect(remove).toHaveBeenLastCalledWith("/vault", "/vault/doc.md", "![[a.png]]")
  expect(change).toHaveBeenCalledExactlyOnceWith("")
})
it("reference deletion never deletes the file; remote images cannot be physically deleted", () => {
  const remove = vi.fn()
  window.electronAPI = { deleteObsidianImage: remove } as any
  const change = vi.fn()
  render(<ObsidianImage reference="![](https://example.com/a.png)" root="/vault" documentPath="/vault/doc.md" onChange={change} />)
  expect(state.props.onDeleteFile).toBeUndefined()
  state.props.onDelete()
  expect(change).toHaveBeenCalledWith("")
  expect(remove).not.toHaveBeenCalled()
})
