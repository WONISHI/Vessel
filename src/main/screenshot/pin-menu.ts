import { clipboard, dialog, Menu, type BrowserWindow, type NativeImage } from "electron"
import { writeFile } from "node:fs/promises"

export function togglePins(pins: Set<BrowserWindow>) {
  const visible = [...pins].some((pin) => !pin.isDestroyed() && pin.isVisible())
  for (const pin of pins) if (!pin.isDestroyed()) visible ? pin.hide() : pin.showInactive()
}

/** Pin actions are scoped to their own window and retain the original image for exports. */
export function registerPinMenu(win: BrowserWindow, image: NativeImage, pins: Set<BrowserWindow>) {
  let placement = "all"
  let shadow = true
  win.webContents.ipc.handle("shot:pin-style", (_event, value: unknown) => {
    if (!value || typeof value !== "object") return
    const style = value as { opacity?: unknown; shadow?: unknown }
    if (typeof style.opacity === "number" && Number.isFinite(style.opacity)) win.setOpacity(Math.max(0.2, Math.min(1, style.opacity)))
    if (typeof style.shadow === "boolean") { shadow = style.shadow; win.setHasShadow(shadow) }
  })
  win.webContents.ipc.handle("shot:pin-menu", () => {
    const place = (mode: string) => {
      placement = mode
      win.setVisibleOnAllWorkspaces(mode === "all", { visibleOnFullScreen: mode === "all", skipTransformProcessType: true })
      win.setAlwaysOnTop(mode !== "normal", mode === "all" ? "screen-saver" : "floating")
    }
    Menu.buildFromTemplate([
      { label: "复制", click: () => clipboard.writeImage(image) },
      { label: "下载", click: () => { void (async () => {
        const result = await dialog.showSaveDialog(win, { defaultPath: `Vessel-${Date.now()}.png`, filters: [{ name: "PNG 图片", extensions: ["png"] }] })
        if (!result.canceled && result.filePath) await writeFile(result.filePath, image.toPNG())
      })().catch((error) => dialog.showErrorBox("保存贴图失败", String(error))) } },
      { type: "separator" },
      { label: "展开 / 收起样式工具条", click: () => win.webContents.send("shot:pin-style-toggle") },
      { label: "显示 / 隐藏全部钉图文", accelerator: "Alt+Shift+P", click: () => togglePins(pins) },
      { type: "separator" },
      ...([["normal", "仅当前桌面但不置顶"], ["current", "当前桌面置顶"], ["all", "所有桌面置顶"]] as const).map(([mode, label]) => ({ label, type: "radio" as const, checked: placement === mode, click: () => place(mode) })),
      { type: "separator" },
      { label: "设置", submenu: [
        { label: "显示阴影", type: "checkbox", checked: shadow, click: (item) => { shadow = item.checked; win.setHasShadow(shadow) } },
        { label: "恢复不透明", click: () => win.setOpacity(1) }
      ] },
      { type: "separator" },
      { label: "从桌面移除", click: () => win.close() }
    ]).popup({ window: win })
  })
}
