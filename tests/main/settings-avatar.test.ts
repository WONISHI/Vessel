import { afterEach, expect, it, vi } from "vitest"
import { mkdtemp, writeFile, rm } from "node:fs/promises"
import { join } from "node:path"
import { tmpdir } from "node:os"
const mocks = vi.hoisted(() => ({ open: vi.fn(), decode: vi.fn(), owner: {} }))
vi.mock("electron", () => ({ BrowserWindow: { fromWebContents: () => mocks.owner }, dialog: { showOpenDialog: mocks.open }, nativeImage: { createFromBuffer: mocks.decode } }))
import { chooseAvatar } from "@main/settings/avatar"
let directory: string | undefined
afterEach(async () => { if (directory) await rm(directory, { recursive: true, force: true }); directory = undefined; vi.resetAllMocks() })
it("cancels without replacing the avatar", async () => {
 mocks.open.mockResolvedValue({ canceled: true, filePaths: [] })
 expect(await chooseAvatar({} as never)).toBeNull()
 expect(mocks.decode).not.toHaveBeenCalled()
})
it("normalizes the selected image and limits its dimensions for settings storage", async () => {
 directory = await mkdtemp(join(tmpdir(), "vessel-avatar-"))
 const file = join(directory, "avatar.png")
 await writeFile(file, "image data")
 mocks.open.mockResolvedValue({ canceled: false, filePaths: [file] })
 const resize = vi.fn(() => ({ toDataURL: () => "data:image/png;base64,YQ==" }))
 mocks.decode.mockReturnValue({ isEmpty: () => false, getSize: () => ({ width: 1600, height: 900 }), resize })
 expect(await chooseAvatar({} as never)).toBe("data:image/png;base64,YQ==")
 expect(resize).toHaveBeenCalledWith({ width: 512 })
 expect(mocks.open.mock.calls[0][0]).toBe(mocks.owner)
})
it("rejects oversized or unreadable images with an actionable error", async () => {
 directory = await mkdtemp(join(tmpdir(), "vessel-avatar-"))
 const file = join(directory, "avatar.png")
 mocks.open.mockResolvedValue({ canceled: false, filePaths: [file] })
 await writeFile(file, Buffer.alloc(2 * 1024 * 1024 + 1))
 await expect(chooseAvatar({} as never)).rejects.toThrow("2 MB")
 expect(mocks.decode).not.toHaveBeenCalled()
 await writeFile(file, "broken")
 mocks.decode.mockReturnValue({ isEmpty: () => true })
 await expect(chooseAvatar({} as never)).rejects.toThrow("无法读取图片")
})
