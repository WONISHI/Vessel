import { useBrowserState } from "@/pages/browser/components/browser-page/hooks/use-browser-state"
import { useBrowserActions } from "@/pages/browser/components/browser-page/hooks/use-browser-actions"

/** 汇总浏览器页所需的全部状态与操作 */
export function useBrowserPage(visible: boolean) {
  const state = useBrowserState(visible)
  const actions = useBrowserActions(state, visible)
  return { ...state, ...actions }
}

export type BrowserPageModel = ReturnType<typeof useBrowserPage>
