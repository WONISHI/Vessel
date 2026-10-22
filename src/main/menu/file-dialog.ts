import { BrowserWindow, dialog, ipcMain } from "electron"
import { writeFile } from "node:fs/promises"
import type { NativeMenuAPI } from "@vessel/type"

/** Native destination dialogs always retain OS overwrite confirmation. */
export function installFileMenuDialog() {
  ipcMain.handle("file-menu:dialog", async (event, request: Parameters<NativeMenuAPI["fileMenuDialog"]>[0]) => {
    const owner = BrowserWindow.fromWebContents(event.sender)
    if (!owner || !request || !["open", "save", "pdf"].includes(request.action)) throw new Error("无效的文件菜单请求")
    if (request.action === "open") {
      const result = await dialog.showOpenDialog(owner, { title: "打开文件", properties: ["openFile"] })
      return result.canceled ? null : result.filePaths[0] ?? null
    }
    if (request.action === "save" && typeof request.content !== "string") throw new Error("缺少文档内容")
    if (request.action === "pdf" && typeof request.html !== "string") throw new Error("缺少 PDF 内容")
    const result = await dialog.showSaveDialog(owner, {
      title: request.action === "pdf" ? "导出 PDF" : "保存文档",
      defaultPath: typeof request.defaultPath === "string" ? request.defaultPath : undefined,
      filters: request.action === "pdf" ? [{ name: "PDF 文档", extensions: ["pdf"] }] : request.markdown ? [{ name: "Markdown 文档", extensions: ["md"] }] : undefined
    })
    if (result.canceled || !result.filePath) return null
    if (request.action === "save") {
      await writeFile(result.filePath, request.content!, "utf8")
      return result.filePath
    }
    const printWindow = new BrowserWindow({ show: false, webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false, javascript: false } })
    printWindow.webContents.setWindowOpenHandler(() => ({ action: "deny" }))
    try {
      await printWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(request.html!)}`)
      const pdf = await printWindow.webContents.printToPDF({ printBackground: true, preferCSSPageSize: true })
      await writeFile(result.filePath, pdf)
      return result.filePath
    } finally { printWindow.destroy() }
  })
}
