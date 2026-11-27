import { Guest } from '@/pages/browser/components/guest'
import type { BrowserPageModel } from './hooks/use-browser-page'

type GuestModel = Pick<BrowserPageModel, 'allTabs' | 'activatedTabs' | 'privateWindow' | 'tab' | 'registerView' | 'update'>

/** Keep webviews in a stable DOM order: moving an Electron webview reloads its guest. */
export function BrowserGuestViews({ b, visible }: { b: GuestModel; visible: boolean }) {
  return b.allTabs
    .filter(item => (item.url || item.back || item.forward) && !item.frozen && b.activatedTabs.has(item.id))
    .sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
    .map(item => <Guest
      key={item.id}
      tab={item}
      partition={b.privateWindow?.tabs.some(entry => entry.id === item.id) ? b.privateWindow.partition : undefined}
      visible={visible && item.id === b.tab.id && !!item.url}
      register={b.registerView}
      update={b.update}
    />)
}
