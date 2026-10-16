import errorWide from "@/assets/vessel-image-placeholder/error-16x9.svg"
import errorSquare from "@/assets/vessel-image-placeholder/error-1x1.svg"
import error from "@/assets/vessel-image-placeholder/error-4x3.svg"
import loadingWide from "@/assets/vessel-image-placeholder/loading-16x9.svg"
import loadingSquare from "@/assets/vessel-image-placeholder/loading-1x1.svg"
import loading from "@/assets/vessel-image-placeholder/loading-4x3.svg"
import placeholderWide from "@/assets/vessel-image-placeholder/placeholder-16x9.svg"
import placeholderSquare from "@/assets/vessel-image-placeholder/placeholder-1x1.svg"
import placeholder from "@/assets/vessel-image-placeholder/placeholder-4x3.svg"
import { type ComponentPropsWithoutRef } from "react"
export interface ImageProps extends Omit<ComponentPropsWithoutRef<"img">, "width"> {
  remote?: boolean
  onDownloadLocal?: () => Promise<void>
  onFocusAbove?: () => void
  onFocusBelow?: () => void
  onViewLink?: () => void
  onDelete?: () => void
  width?: number
  resizable?: boolean
  onResizeEnd?: (width: number) => void
  /** 本地附件等异步来源，仅在进入可视区域后调用。 */
  loadSource?: () => Promise<string>
  sourceKey?: string
  placeholderRatio?: "1x1" | "4x3" | "16x9"
}
export const artwork = {
  "1x1": { placeholder: placeholderSquare, loading: loadingSquare, error: errorSquare },
  "4x3": { placeholder, loading, error },
  "16x9": { placeholder: placeholderWide, loading: loadingWide, error: errorWide }
}

/** Normalizes svg. */
export function normalizeSvg(source?: string): string | undefined {
  if (!source?.startsWith("data:image/svg+xml")) return source
  try {
    const comma = source.indexOf(",")
    const raw = source.slice(0, comma).includes(";base64") ? new TextDecoder().decode(Uint8Array.from(atob(source.slice(comma + 1)), (c) => c.charCodeAt(0))) : decodeURIComponent(source.slice(comma + 1))
    const svg = new DOMParser().parseFromString(raw, "image/svg+xml")
    if (svg.documentElement.localName !== "svg") return source
    svg.documentElement.setAttribute("xmlns", "http://www.w3.org/2000/svg")
    return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(new XMLSerializer().serializeToString(svg))
  } catch {
    return source
  }
}

/** Performs the image clipboard source operation. */
export async function imageClipboardSource(source: string): Promise<string> {
  if (source.startsWith("data:image/")) {
    const comma = source.indexOf(",")
    if (source.slice(0, comma).includes(";base64")) return source
    const bytes = new TextEncoder().encode(decodeURIComponent(source.slice(comma + 1)))
    let binary = ""
    for (const byte of bytes) binary += String.fromCharCode(byte)
    return source.slice(0, comma) + ";base64," + btoa(binary)
  }
  const response = await fetch(source)
  if (!response.ok) throw new Error("无法读取图片")
  const blob = await response.blob()
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = reject
    reader.readAsDataURL(blob)
  })
}
