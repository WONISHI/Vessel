import { useSyncExternalStore } from "react"

let request: { source: string; id: number } | null = null
const listeners = new Set<() => void>()

/** Hands an image to the activity-bar toolbox, including before its route mounts. */
export function importToolboxImage(source: string) {
  request = { source, id: (request?.id ?? 0) + 1 }
  listeners.forEach((listener) => listener())
}

/** Receives the latest image handoff without persisting image data in local storage. */
export function useToolboxImageImport() {
  return useSyncExternalStore((listener) => {
    listeners.add(listener)
    return () => { listeners.delete(listener) }
  }, () => request)
}
