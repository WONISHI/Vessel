import { mkdtemp, writeFile, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { expect, it, vi } from "vitest"
const mocks = vi.hoisted(() => ({ clear: vi.fn(), writeBuffer: vi.fn(), openExternal: vi.fn().mockResolvedValue(undefined) }))
vi.mock("electron", () => ({ clipboard: { clear: mocks.clear, writeBuffer: mocks.writeBuffer }, shell: { openExternal: mocks.openExternal } }))
import { shareFilesToWechat } from "@main/modules/files/share-wechat"

it("copies a native file attachment, opens only WeChat and rejects folders/outside paths", async () => {
  const root = await mkdtemp(join(tmpdir(), "vessel-wechat-"))
  const file = join(root, "中文 document.md")
  try {
    await writeFile(file, "test document")
    expect(await shareFilesToWechat(root, [file])).toEqual({ opened: true })
    expect(mocks.openExternal).toHaveBeenCalledWith("weixin://")
    expect(mocks.writeBuffer.mock.calls[0][0]).toBe(process.platform === "darwin" ? "public.file-url" : process.platform === "win32" ? "CF_HDROP" : "text/uri-list")
    await expect(shareFilesToWechat(root, [root])).rejects.toThrow()
    await expect(shareFilesToWechat(root, [process.execPath])).rejects.toThrow("工作区")
    mocks.openExternal.mockRejectedValueOnce(new Error("not installed"))
    expect(await shareFilesToWechat(root, [file])).toEqual({ opened: false })
  } finally { await rm(root, { recursive: true, force: true }) }
})
