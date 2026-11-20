import { BrowserWindow, dialog, nativeImage, type WebContents } from "electron"
import { lstat, readFile } from "node:fs/promises"

/** Selects and normalizes a local avatar through the owning native window. */
export async function chooseAvatar(host: WebContents): Promise<string | null> {
    const owner = BrowserWindow.fromWebContents(host)
    if (!owner) throw new Error("无法打开图片选择窗口")
    const result = await dialog.showOpenDialog(owner, { title: "选择头像", properties: ["openFile"], filters: [{ name: "图片", extensions: ["png", "jpg", "jpeg"] }] })
    if (result.canceled || !result.filePaths[0]) return null
    const file = result.filePaths[0]
    if ((await lstat(file)).size > 2 * 1024 * 1024) throw new Error("头像不能超过 2 MB")
    const image = nativeImage.createFromBuffer(await readFile(file))
    if (image.isEmpty()) throw new Error("无法读取图片，请选择有效的 PNG 或 JPEG 图片")
    const { width, height } = image.getSize()
    const avatar = Math.max(width, height) > 512 ? image.resize(width >= height ? { width: 512 } : { height: 512 }) : image
    return avatar.toDataURL()
}
