import { setLayoutPreferences, useLayoutPreferences } from '../layout/preferences'

export function setStatusBarVisible(value: boolean) {
  setLayoutPreferences({ statusBarVisible: value })
}

export function useStatusBarVisible() {
  return useLayoutPreferences().statusBarVisible
}
