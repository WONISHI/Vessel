import type { RouterHistory } from "./types"

function normalizeBasename(basename: string): string {
  if (!basename || basename === "/") {
    return "/"
  }

  return `/${basename.replace(/^\/+|\/+$/g, "")}`
}

export function createWebHistory(
  basename = "/"
): RouterHistory {
  return {
    type: "browser",
    basename: normalizeBasename(basename)
  }
}

export function createWebHashHistory(
  basename = "/"
): RouterHistory {
  return {
    type: "hash",
    basename: normalizeBasename(basename)
  }
}

export function createMemoryHistory(
  initialEntries: string[] = ["/"],
  initialIndex?: number
): RouterHistory {
  return {
    type: "memory",
    basename: "/",
    initialEntries,
    initialIndex
  }
}
