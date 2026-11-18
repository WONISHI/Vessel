import type { WebContents } from "electron"

/** Runs in the DevTools frontend so it can reveal the exact retained DOM node, then its CSS property. */
export function inspectStyleScript(targetKey: string, property: string) {
  return `(async () => {
    const [UI, SDK, Common, Elements] = await Promise.all([
      import('devtools://devtools/bundled/ui/legacy/legacy.js'), import('devtools://devtools/bundled/core/sdk/sdk.js'),
      import('devtools://devtools/bundled/core/common/common.js'), import('devtools://devtools/bundled/panels/elements/elements.js')
    ]);
    await UI.InspectorView.InspectorView.instance().showPanel('elements');
    const manager = SDK.TargetManager.TargetManager.instance();
    const target = manager.primaryPageTarget?.() || manager.mainTarget?.();
    if (!target) throw new Error('找不到当前网页');
    const runtime = target.model(SDK.RuntimeModel.RuntimeModel);
    const response = await target.runtimeAgent().invoke_evaluate({
      expression: ${JSON.stringify(`(() => { const node = window[${JSON.stringify(targetKey)}]; delete window[${JSON.stringify(targetKey)}]; return node; })()`)},
      objectGroup: 'vessel-inspect-style'
    });
    if (!response.result?.objectId) throw new Error('元素已失效，请重新选择');
    const object = runtime.createRemoteObject(response.result);
    try {
      await Common.Revealer.reveal(object);
      const panel = Elements.ElementsPanel.ElementsPanel.instance();
      panel.sidebarPaneView?.tabbedPane().selectTab('styles');
      for (let attempt = 0; attempt < 40; attempt++) {
        if (panel.stylesWidget.jumpToProperty(${JSON.stringify(property)})) return true;
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      // Computed defaults have no authored declaration to jump to; still show the selected node's computed styles.
      panel.revealComputedStylesPane();
      return false;
    } finally { object.release(); }
  })()`
}

export async function revealBrowserStyle(frontend: WebContents, targetKey: string, property: string) {
  if (frontend.isLoading()) await new Promise<void>(resolve => frontend.once("did-finish-load", () => resolve()))
  if (!frontend.isDestroyed()) await frontend.executeJavaScript(inspectStyleScript(targetKey, property))
}
