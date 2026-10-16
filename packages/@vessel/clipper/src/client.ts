import type { ClipPayload, ClipResponse, VesselAppStatus } from "#vessel-clipper/types"

const VESSEL_API_BASE = "http://127.0.0.1:35678"

/**
 * 检查 Vessel 桌面端是否正在运行且已连接
 */
export async function checkVesselStatus(): Promise<VesselAppStatus | null> {
  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 1200)
    const res = await fetch(`${VESSEL_API_BASE}/api/status`, {
      method: "GET",
      signal: controller.signal
    })
    clearTimeout(timer)
    if (!res.ok) return null
    const data = await res.json()
    return data as VesselAppStatus
  } catch {
    return null
  }
}

/**
 * 将剪藏内容发送至 Vessel 桌面端保存到当前工作区
 */
export async function saveClipToVessel(payload: ClipPayload): Promise<ClipResponse> {
  try {
    const res = await fetch(`${VESSEL_API_BASE}/api/clip`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(payload)
    })
    const data = (await res.json()) as ClipResponse
    return data
  } catch (error) {
    return {
      ok: false,
      error: `无法连接到 Vessel 桌面端: ${String(error)}`
    }
  }
}

/**
 * 降级选项：通过浏览器下载为本地 Markdown 文件
 */
export function downloadMarkdownFile(filename: string, content: string): void {
  const blob = new Blob([content], { type: "text/markdown;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/**
 * 复制文本到剪贴板
 */
export async function copyTextToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {}
  return false
}
