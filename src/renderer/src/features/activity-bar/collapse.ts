import { setLayoutPreferences, useLayoutPreferences } from '../layout/preferences'

export function setActivityBarCollapsed(value: boolean) {
  setLayoutPreferences({ activityBarCollapsed: value })
}

/** Shared by every page's activity bar and title bar controls. */
export function useActivityBarCollapsed() {
  return useLayoutPreferences().activityBarCollapsed
}
