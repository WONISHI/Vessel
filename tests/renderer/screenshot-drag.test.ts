// @vitest-environment jsdom
import { expect, it, vi } from "vitest"
import { readFileSync } from "node:fs"
import { resolve } from "node:path"

it("ensures screenshot plugin retains drag handles and drag behavior during annotation mode", () => {
  const esmPath = resolve(__dirname, "../../node_modules/js-web-screen-shot/dist/screenShotPlugin.esm.js")
  const code = readFileSync(esmPath, "utf8")

  // 1. In Do: drawBorders is true
  expect(code).toContain("setToolStatus(!0);var i=o.cutOutBoxPosition;Jn(i.startX,i.startY,i.width,i.height,A,o.borderSize,e,t,!0)")

  // 2. In ro: drawBorders is true
  expect(code).toContain("var i=Nn.cutOutBoxPosition;Jn(i.startX,i.startY,i.width,i.height,A,Nn.borderSize,r,o,!0)")

  // 3. In Es: allow ys to detect border handles in annotation mode
  expect(code).toContain("Gr.selectionBorderNodes.length>0&&!Nn.draggingTrim&&ys(A,e,i)")

  // 4. In ys: skip lo.Move when toolClickStatus is true
  expect(code).toContain("if(Jr.toolClickStatus&&o.option===lo.Move)continue;")

  // 5. In oa: allow resize dragging even when toolClickStatus is true
  expect(code).toContain("!Jr.toolClickStatus||Nn.dragging?Jr.toolClickStatus&&Nn.dragging&&!Nn.draggingTrim?Vs(")

  // 6. In ia: if borderOption was active on mouseup, update position and reposition tools
  expect(code).toContain("Gr.borderOption?(Ss(),xs(),Ds(e),Gr.updateBorderOption(null))")

  // The update setter returns void: keep the comma condition so initial crop dimensions persist.
  expect(code).toContain("Gr.tempGraphPosition.height),(!Jr.toolClickStatus||Nn.draggingTrim)){var A=Nn.drawGraphPosition")

  // 7. In Ss: update cutOutBoxPosition and redraw canvas elements
  expect(code).toContain("Nn.setCutOutBoxPosition(e,t,n,r);Gr.redrawCanvasElements()")
})
