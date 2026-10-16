const { readFileSync, writeFileSync, existsSync } = require("node:fs")
const { join } = require("node:path")

const targets = [join(__dirname, "../node_modules/js-web-screen-shot/dist/screenShotPlugin.esm.js"), join(__dirname, "../node_modules/js-web-screen-shot/dist/screenShotPlugin.common.js")]

/** Patches file. */
function patchFile(filePath) {
  if (!existsSync(filePath)) return
  let code = readFileSync(filePath, "utf8")
  const orig = code

  // 1. Keep borders drawn in Do and ro
  code = code.replace("setToolStatus(!0);var i=o.cutOutBoxPosition;Jn(i.startX,i.startY,i.width,i.height,A,o.borderSize,e,t,!1)", "setToolStatus(!0);var i=o.cutOutBoxPosition;Jn(i.startX,i.startY,i.width,i.height,A,o.borderSize,e,t,!0)")
  code = code.replace("var i=Nn.cutOutBoxPosition;Jn(i.startX,i.startY,i.width,i.height,A,Nn.borderSize,r,o,!1)", "var i=Nn.cutOutBoxPosition;Jn(i.startX,i.startY,i.width,i.height,A,Nn.borderSize,r,o,!0)")

  // 2. Allow ys to detect border handles in annotation mode
  code = code.replace("Gr.selectionBorderNodes.length>0&&!Jr.toolClickStatus&&!Nn.draggingTrim&&ys(A,e,i)", "Gr.selectionBorderNodes.length>0&&!Nn.draggingTrim&&ys(A,e,i)")

  // 3. Skip lo.Move in ys when in annotation mode so annotations can be drawn inside
  code = code.replace(
    "for(var r=0;r<Gr.selectionBorderNodes.length;r++){var o=Gr.selectionBorderNodes[r];if(t.rect(o.x,o.y,o.width,o.height)",
    "for(var r=0;r<Gr.selectionBorderNodes.length;r++){var o=Gr.selectionBorderNodes[r];if(Jr.toolClickStatus&&o.option===lo.Move)continue;if(t.rect(o.x,o.y,o.width,o.height)"
  )

  // 4. In oa, allow resize dragging even when toolClickStatus is true
  code = code.replace("!Jr.toolClickStatus||Nn.dragging?Jr.toolClickStatus&&Nn.dragging?Vs(", "!Jr.toolClickStatus||Nn.dragging?Jr.toolClickStatus&&Nn.dragging&&!Nn.draggingTrim?Vs(")

  // 5. In ia: if borderOption was active on mouseup, update position and reposition tools
  code = code.replace("bs()&&(Is(t),Hs(t,n)||(Ss(),xs(),Ks(A)&&Ds(e)))", "bs()&&(Is(t),Gr.borderOption?(Ss(),xs(),Ds(e),Gr.updateBorderOption(null)):(Hs(t,n)||(Ss(),xs(),Ks(A)&&Ds(e))))")

  // 6. In Ss: update cutOutBoxPosition and redraw elements
  code = code.replace("Gr.tempGraphPosition.height),!Jr.toolClickStatus){var A=Nn.drawGraphPosition", "Gr.tempGraphPosition.height)){var A=Nn.drawGraphPosition")
  code = code.replace("Nn.setCutOutBoxPosition(e,t,n,r)}}", "Nn.setCutOutBoxPosition(e,t,n,r);Gr.redrawCanvasElements()}}")

  if (code !== orig) {
    writeFileSync(filePath, code, "utf8")
    console.log("Patched screenshot plugin:", filePath)
  }
}

for (const target of targets) {
  patchFile(target)
}
