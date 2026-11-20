export interface ManagedSourceProject { url: string; running: boolean }

/** A local address alone is insufficient: it must belong to Vessel's live managed server and base path. */
export function isManagedSourcePage(href: string, project: ManagedSourceProject | null | undefined): boolean {
  if (!project?.running || !project.url) return false
  try {
    const page = new URL(href), server = new URL(project.url)
    if (!['http:', 'https:'].includes(page.protocol) || page.origin !== server.origin) return false
    const base = server.pathname.replace(/\/+$/, '')
    return !base || page.pathname === base || page.pathname.startsWith(base + '/')
  } catch { return false }
}
