import { webContents, type BrowserWindow, type WebContents } from "electron"
import { execFile } from "node:child_process"
import { promisify } from "node:util"

export type ClipboardPasteTarget = { kind: "vessel"; window: BrowserWindow; contents: WebContents } | { kind: "external"; id: string }
const execute = promisify(execFile)
const windowsAPI = 'Add-Type -TypeDefinition \'using System; using System.Runtime.InteropServices; public class ClipboardTarget { [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow(); [DllImport("user32.dll")] public static extern bool SetForegroundWindow(IntPtr h); [DllImport("user32.dll")] public static extern bool IsWindow(IntPtr h); }\'; '

/** Capture before opening the panel so the panel's search field never becomes the paste target. */
export async function captureClipboardTarget(window: BrowserWindow | null, helper: string): Promise<ClipboardPasteTarget | undefined> {
  if (window && !window.isDestroyed()) {
    const contents = webContents.getFocusedWebContents() || window.webContents
    return { kind: "vessel", window, contents }
  }
  try {
    const result = process.platform === "darwin"
      ? await execute(helper, ["--frontmost-pid"], { timeout: 3000 })
      : process.platform === "win32"
        ? await execute("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", windowsAPI + "[ClipboardTarget]::GetForegroundWindow().ToInt64()"], { timeout: 5000, windowsHide: true })
        : await execute("xdotool", ["getwindowfocus"], { timeout: 3000 })
    const id = result.stdout.trim()
    if (/^[1-9]\d*$/.test(id)) return { kind: "external", id }
  } catch { /* Copy remains available when native focus capture is unavailable. */ }
  return undefined
}

export async function pasteToClipboardTarget(target: ClipboardPasteTarget | undefined, helper: string) {
  if (!target) throw new Error("没有可粘贴的目标，请先聚焦输入位置再打开剪贴板；内容已复制，可手动粘贴。")
  if (target.kind === "vessel") {
    if (target.window.isDestroyed() || target.contents.isDestroyed()) throw new Error("原来的输入窗口已关闭；内容已复制，可手动粘贴。")
    if (target.window.isMinimized()) target.window.restore()
    target.window.show()
    target.window.focus()
    target.contents.focus()
    target.contents.paste()
    return
  }
  if (!/^[1-9]\d*$/.test(target.id)) throw new Error("粘贴目标无效")
  if (process.platform === "darwin") {
    await execute(helper, ["--paste-to", target.id], { timeout: 5000 })
  } else if (process.platform === "win32") {
    const command = windowsAPI + `$h=[IntPtr]::new(${target.id}); if(-not [ClipboardTarget]::IsWindow($h)){throw '原来的输入窗口已关闭'}; [void][ClipboardTarget]::SetForegroundWindow($h); $ready=$false; for($i=0;$i -lt 20;$i++){Start-Sleep -Milliseconds 25; if([ClipboardTarget]::GetForegroundWindow() -eq $h){$ready=$true; break}}; if(-not $ready){throw '无法恢复原来的输入窗口'}; Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait('^v')`
    await execute("powershell.exe", ["-NoProfile", "-NonInteractive", "-Command", command], { timeout: 5000, windowsHide: true })
  } else {
    await execute("xdotool", ["windowactivate", "--sync", target.id, "key", "--clearmodifiers", "ctrl+v"], { timeout: 5000 })
  }
}
