import React from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { expect, it } from "vitest"
import { webviewAttributes } from "../../src/renderer/src/pages/browser/webview-attributes"
it("keeps Electron's popup attribute in the DOM so target=_blank reaches the main-process handler", () => {
  const markup = renderToStaticMarkup(<webview {...webviewAttributes} />)
  expect(markup).toContain('allowpopups="true"')
  expect(markup).toContain('partition="persist:vessel-browser"')
})
