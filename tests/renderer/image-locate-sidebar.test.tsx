import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, expect, it, vi } from "vitest"
import { ObsidianImage } from "@/components/core/canvas/variants/markdown/obsidian-images/components/obsidian-image"
vi.mock("@/components/ui/image", () => ({
  Image: ({ onLocateFile }: { onLocateFile?: () => Promise<void> }) => <button disabled={!onLocateFile} onClick={() => void onLocateFile?.()}>查找文件位置</button>
}))
afterEach(cleanup)
it("reveals the attachment in the workspace sidebar without opening its document", async () => {
  const resolve = vi.fn().mockResolvedValue("/vault/images/图片.png")
  window.electronAPI = { ...window.electronAPI, resolveObsidianImage: resolve }
  const reveal = vi.fn()
  window.addEventListener("vessel:reveal-file", reveal)
  render(<ObsidianImage reference="![[图片.png]]" root="/vault" documentPath="/vault/笔记.md" onChange={vi.fn()} />)
  fireEvent.click(screen.getByText("查找文件位置"))
  await waitFor(() => expect(reveal).toHaveBeenCalled())
  expect(resolve).toHaveBeenCalledWith("/vault", "/vault/笔记.md", "![[图片.png]]")
  expect((reveal.mock.calls[0][0] as CustomEvent).detail).toBe("/vault/images/图片.png")
  window.removeEventListener("vessel:reveal-file", reveal)
})
