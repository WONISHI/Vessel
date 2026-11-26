import type { WebContents } from "electron"
import type { BrowserDevtoolsLanguage } from "@vessel/type"

const pending = new WeakMap<WebContents, Promise<unknown>>()

/** Use DevTools' own language setting and reload only its frontend when it changes. */
export function applyBrowserDevtoolsLanguage(target: WebContents, language: BrowserDevtoolsLanguage): Promise<boolean> {
  if (language !== "zh" && language !== "en-US") return Promise.reject(new Error("控制台界面语言无效"))
  const next = (pending.get(target) || Promise.resolve()).catch(() => {}).then(async () => {
    if (target.isDestroyed()) return false
    const changed = await target.executeJavaScript(`(async () => {
      const common = await import('./core/common/common.js');
      const deadline = Date.now() + 5000;
      while (Date.now() < deadline) {
        let setting;
        try { setting = common.Settings.Settings.instance().moduleSetting('language'); } catch {}
        if (setting) {
          if (setting.get() === ${JSON.stringify(language)}) return false;
          setting.set(${JSON.stringify(language)});
          return true;
        }
        await new Promise(resolve => setTimeout(resolve, 50));
      }
      throw new Error('控制台语言设置尚未就绪');
    })()`)
    if (changed && !target.isDestroyed()) target.reload()
    return !!changed
  })
  pending.set(target, next)
  return next
}
