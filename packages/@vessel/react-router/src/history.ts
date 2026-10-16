import type { RouterHistory } from "#vessel-react-router/types"

/** Normalizes basename. */
function normalizeBasename(basename: string): string {
  if (!basename || basename === "/") {
    return "/"
  }

  return `/${basename.replace(/^\/+|\/+$/g, "")}`
}

/** Creates web history. */
export function createWebHistory(basename = "/"): RouterHistory {
  return {
    type: "browser",
    basename: normalizeBasename(basename)
  }
}

/** Creates web hash history. */
export function createWebHashHistory(basename = "/"): RouterHistory {
  return {
    type: "hash",
    basename: normalizeBasename(basename)
  }
}

/** Creates memory history. */
export function createMemoryHistory(initialEntries: string[] = ["/"], initialIndex?: number): RouterHistory {
  return {
    type: "memory",
    basename: "/",
    initialEntries,
    initialIndex
  }
}
