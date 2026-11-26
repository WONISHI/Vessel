import type { LibraryProject } from "./library-state"

/** Cached resource workspaces keep their editors and shells alive while switching. */
export function useProjectSwitchConfirmation() {
  return { requestSwitch: (_target: LibraryProject, proceed: () => void) => proceed(), confirmation: null }
}
