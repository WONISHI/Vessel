export type Project = { name: string; path: string }

/** Last loaded project list, so reopening the hover preview never flashes an empty state. */
export const projectCache: { projects: Project[] | null } = { projects: null }
