import { runInNewContext } from "node:vm"
import { expect, it, vi } from "vitest"
import { browserElementInspectionScript } from "@main/browser/browser-devtools-inspect"

it("reveals the resolved picked node and clears the stale overlay after selection finishes", async () => {
  let inspect: (node: object) => void = () => {}
  let finish: () => void = () => {}
  const clearHighlight = vi.fn()
  const reveal = vi.fn(() => new Promise<void>(resolve => { finish = resolve }))
  const OverlayModel = { setInspectNodeHandler: (handler: typeof inspect) => { inspect = handler } }
  const SDK = { OverlayModel: { OverlayModel } }
  const Common = { Revealer: { reveal } }
  const script = browserElementInspectionScript()
    .replace("import('devtools://devtools/bundled/core/sdk/sdk.js')", "Promise.resolve(globalThis.SDK)")
    .replace("import('devtools://devtools/bundled/core/common/common.js')", "Promise.resolve(globalThis.Common)")
  await runInNewContext(script, { SDK, Common })
  const node = { domModel: () => ({ target: () => ({ model: () => ({ clearHighlight }) }) }) }
  inspect(node)
  expect(reveal).toHaveBeenCalledExactlyOnceWith(node)
  expect(clearHighlight).not.toHaveBeenCalled()
  finish()
  await Promise.resolve()
  expect(clearHighlight).toHaveBeenCalledTimes(1)
})
