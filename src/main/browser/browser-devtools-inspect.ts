import type { WebContents } from "electron"

/** Reveal the resolved picked node and finish its overlay lifecycle in our custom frontend. */
export function browserElementInspectionScript() {
  return `(async () => {
    if (globalThis.__vesselElementInspection) return;
    const [SDK, Common] = await Promise.all([
      import('devtools://devtools/bundled/core/sdk/sdk.js'),
      import('devtools://devtools/bundled/core/common/common.js')
    ]);
    SDK.OverlayModel.OverlayModel.setInspectNodeHandler(node => {
      void Common.Revealer.reveal(node).then(() => {
        // The picker is finished. Do not leave a stale page-wide hover overlay behind.
        node.domModel().target().model(SDK.OverlayModel.OverlayModel)?.clearHighlight();
      }).catch(error => console.error('Vessel element inspection:', error));
    });
    globalThis.__vesselElementInspection = true;
  })()`
}

export async function enableBrowserElementInspection(frontend: WebContents) {
  if (!frontend.isDestroyed()) await frontend.executeJavaScript(browserElementInspectionScript())
}
