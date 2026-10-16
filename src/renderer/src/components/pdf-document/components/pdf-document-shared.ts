import workerURL from "pdfjs-dist/build/pdf.worker.min.mjs?url"
import { pdfjs } from "react-pdf"
import { toast } from "sonner"
export const COLORS = ["#e11d48", "#f97316", "#f59e0b", "#eab308", "#84cc16", "#16a34a", "#14b8a6", "#06b6d4", "#3b82f6", "#6366f1", "#8b5cf6", "#d946ef", "#ec4899", "#78716c", "#44403c", "#000000", "#a8a29e", "#ffffff"]
export type Stroke = { id: string; page: number; color: string; width: number; points: [number, number][] }

/** Reads ink strokes. */
export async function readInkStrokes(key: string): Promise<Stroke[]> {
  try {
    if (typeof window !== "undefined" && window.electronAPI?.getAppState) {
      const value = await window.electronAPI.getAppState<Stroke[]>(key)
      return Array.isArray(value) ? value : []
    }
  } catch {}
  try {
    const raw = localStorage.getItem(key)
    const parsed = raw ? JSON.parse(raw) : null
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

/** Writes ink strokes. */
export async function writeInkStrokes(key: string, next: Stroke[]): Promise<void> {
  try {
    if (typeof window !== "undefined" && window.electronAPI?.setAppState) {
      await window.electronAPI.setAppState(key, next)
      return
    }
  } catch {}
  try {
    localStorage.setItem(key, JSON.stringify(next))
  } catch {}
}

/** Performs the notify error operation. */
export function notifyError(msg: string) {
  try {
    toast.error(msg)
  } catch {
    console.error(msg)
  }
}

pdfjs.GlobalWorkerOptions.workerSrc = workerURL
