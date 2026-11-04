import { BrowserWindow, webContents } from 'electron'
import type { PerformanceSource, MainMemoryDiagnostic } from '@vessel/type'
import { performance } from 'node:perf_hooks'
import { getCodeDiagnosticsState } from '@main/diagnostics/code-diagnostics'

/** Diagnostic URLs omit credentials, query parameters and non-route fragments. */
export function diagnosticUrl(raw: string) {
  try {
    const url = new URL(raw)
    url.username = ''; url.password = ''; url.search = ''
    if (!url.hash.startsWith('#/')) url.hash = ''
    if (url.protocol === 'file:') return decodeURIComponent(url.pathname.split('/').pop() || 'file') + url.hash.split('?')[0]
    url.hash = url.hash.split('?')[0]
    return url.toString().slice(0, 240)
  } catch { return '' }
}

export function collectPerformanceSources() {
  const sources = new Map<number, PerformanceSource[]>()
  const contents = webContents.getAllWebContents()
  let frameCount = 0
  for (const contentsEntry of contents) {
    try {
      if (contentsEntry.isDestroyed()) continue
      const owner = BrowserWindow.fromWebContents(contentsEntry) ?? (contentsEntry.hostWebContents ? BrowserWindow.fromWebContents(contentsEntry.hostWebContents) : null)
      const type = contentsEntry.getType()
      for (const frame of contentsEntry.mainFrame.framesInSubtree) {
        try {
          frameCount++
          const pid = frame.osProcessId
          if (pid <= 0) continue
          const raw = frame.url
          const url = diagnosticUrl(raw)
          const kind = raw.startsWith('devtools:') ? '开发者工具' : /\/office(?:\.html|\/)/i.test(raw) ? 'Office 页面' : type === 'webview' ? '浏览器网页' : /standalonePreview=1/.test(raw) ? '独立预览窗口' : frame.parent ? '子页面' : type === 'window' ? '应用窗口' : '后台页面'
          const entries = sources.get(pid) ?? []
          if (entries.length < 50) entries.push({ webContentsId: contentsEntry.id, frameId: frame.frameTreeNodeId, kind, title: (frame.parent ? frame.name : contentsEntry.getTitle()).slice(0, 160), url, windowTitle: owner?.getTitle().slice(0, 160) ?? '', visible: owner && type === 'window' ? owner.isVisible() && !owner.isMinimized() : null })
          sources.set(pid, entries)
        } catch { /* Frame may be detached during navigation. */ }
      }
    } catch { /* WebContents may close while sampling. */ }
  }
  return { sources, resources: { windows: BrowserWindow.getAllWindows().length, webContents: contents.length, frames: frameCount } }
}

export function createMainMemoryReader() {
  let previous = performance.eventLoopUtilization()
  let warm = false
  return (): MainMemoryDiagnostic => {
    const current = performance.eventLoopUtilization()
    const delta = performance.eventLoopUtilization(current, previous)
    previous = current
    const utilization = warm ? delta.utilization : null
    warm = true
    return { ...process.memoryUsage(), eventLoopUtilization: utilization, diagnosticsWorker: getCodeDiagnosticsState() }
  }
}
