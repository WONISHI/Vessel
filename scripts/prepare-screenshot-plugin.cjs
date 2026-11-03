const { readFileSync, writeFileSync, existsSync } = require("node:fs")
const { join } = require("node:path")

const targets = [join(__dirname, "../node_modules/js-web-screen-shot/dist/screenShotPlugin.esm.js"), join(__dirname, "../node_modules/js-web-screen-shot/dist/screenShotPlugin.common.js")]

/** Patches file. */
function patchFile(filePath) {
  if (!existsSync(filePath)) return
  let code = readFileSync(filePath, "utf8")
  const orig = code

  // Round white selection handles and a thin blue outline; keep original hit areas.
  code = code.replace("var h=o;r.fillRect(A-h/2,e-h/2,h,h),r.fillRect(A-h/2+t/2,e-h/2,h,h),r.fillRect(A-h/2+t,e-h/2,h,h),r.fillRect(A-h/2,e-h/2+n/2,h,h),r.fillRect(A-h/2+t,e-h/2+n/2,h,h),r.fillRect(A-h/2,e-h/2+n,h,h),r.fillRect(A-h/2+t/2,e-h/2+n,h,h),r.fillRect(A-h/2+t,e-h/2+n,h,h)", "r.strokeStyle=Hn.cutBoxBdColor,r.lineWidth=1,r.strokeRect(A,e,t,n),Wn(A,e,t,n).forEach(function(P){r.beginPath(),r.arc(P.x,P.y,3.5,0,2*Math.PI),r.fillStyle=\"#ffffff\",r.fill(),r.strokeStyle=\"#c7c9cc\",r.lineWidth=1,r.stroke()})")
  // 1. Keep borders drawn in Do and ro
  code = code.replace("setToolStatus(!0);var i=o.cutOutBoxPosition;Jn(i.startX,i.startY,i.width,i.height,A,o.borderSize,e,t,!1)", "setToolStatus(!0);var i=o.cutOutBoxPosition;Jn(i.startX,i.startY,i.width,i.height,A,o.borderSize,e,t,!0)")
  code = code.replace("var i=Nn.cutOutBoxPosition;Jn(i.startX,i.startY,i.width,i.height,A,Nn.borderSize,r,o,!1)", "var i=Nn.cutOutBoxPosition;Jn(i.startX,i.startY,i.width,i.height,A,Nn.borderSize,r,o,!0)")

  // 2. Allow ys to detect border handles in annotation mode
  code = code.replace("Gr.selectionBorderNodes.length>0&&!Jr.toolClickStatus&&!Nn.draggingTrim&&ys(A,e,i)", "Gr.selectionBorderNodes.length>0&&!Nn.draggingTrim&&ys(A,e,i)")

  // 3. Skip lo.Move while drawing; keep Move for text (mouseInsideCropBox). Clear borderOption on
  // text+Move hits so Ms()/mouseUp do not crop-drag away #textInputPanel.
  code = code.replace(
    /if\s*\(\s*Jr\.toolClickStatus\s*&&\s*(\w+)\.option\s*===\s*lo\.Move\s*\)\s*continue\s*;/g,
    'if(Jr.toolClickStatus&&$1.option===lo.Move&&"text"!==Jr.toolName)continue;'
  )
  code = code.replace(
    /if\s*\(\s*Jr\.toolClickStatus\s*&&\s*(\w+)\.option\s*===\s*lo\.Move\s*&&\s*"text"\s*!==\s*Jr\.toolName\s*\)\s*continue\s*;/g,
    'if(Jr.toolClickStatus&&$1.option===lo.Move&&"text"!==Jr.toolName)continue;'
  )
  code = code.replace(
    "for(var r=0;r<Gr.selectionBorderNodes.length;r++){var o=Gr.selectionBorderNodes[r];if(t.rect(o.x,o.y,o.width,o.height)",
    'for(var r=0;r<Gr.selectionBorderNodes.length;r++){var o=Gr.selectionBorderNodes[r];if(Jr.toolClickStatus&&o.option===lo.Move&&"text"!==Jr.toolName)continue;if(t.rect(o.x,o.y,o.width,o.height)'
  )
  code = code.replace(
    /Fs\((\w+)\.index\),Gr\.updateBorderOption\(\1\.option\),(\w+)=!0/g,
    'Fs($1.index),Jr.toolClickStatus&&$1.option===lo.Move&&"text"===Jr.toolName?Gr.updateBorderOption(null):Gr.updateBorderOption($1.option),$2=!0'
  )
  code = code.replace(
    /Fs\((\w+)\.index\)\s*,\s*Gr\.updateBorderOption\(\1\.option\)\s*,\s*(\w+)\s*=\s*true/g,
    'Fs($1.index),Jr.toolClickStatus&&$1.option===lo.Move&&"text"===Jr.toolName?Gr.updateBorderOption(null):Gr.updateBorderOption($1.option),$2=true'
  )

  // 4. In oa, allow resize dragging even when toolClickStatus is true
  code = code.replace("!Jr.toolClickStatus||Nn.dragging?Jr.toolClickStatus&&Nn.dragging?Vs(", "!Jr.toolClickStatus||Nn.dragging?Jr.toolClickStatus&&Nn.dragging&&!Nn.draggingTrim?Vs(")

  // 5. In ia: if borderOption was active on mouseup, update position and reposition tools
  code = code.replace("bs()&&(Is(t),Hs(t,n)||(Ss(),xs(),Ks(A)&&Ds(e)))", "bs()&&(Is(t),Gr.borderOption?(Ss(),xs(),Ds(e),Gr.updateBorderOption(null)):(Hs(t,n)||(Ss(),xs(),Ks(A)&&Ds(e))))")

  // 7. Show live cut-box size while drag-selecting (mouse still down).
  code = code.replace(
    "!Jr.toolClickStatus&&Nn.dragging&&(e.dragFlag=!0,Jr.setToolStatus(!1),Nn.setCutBoxSizeStatus(!1)),oa(A,e.screenShotImageController,e.drawArrow)",
    "!Jr.toolClickStatus&&Nn.dragging&&(e.dragFlag=!0,Jr.setToolStatus(!1)),oa(A,e.screenShotImageController,e.drawArrow),!Jr.toolClickStatus&&Nn.dragging&&!Nn.draggingTrim&&function(){var A=Gr.tempGraphPosition;A.width>0&&A.height>0&&(Nn.setCutBoxSizeStatus(!0),Nn.setCutBoxSizePosition(A.startX,A.startY-35),Nn.setCutBoxSize(A.width,A.height))}()"
  )

  // 6. In Ss: update cutOutBoxPosition and redraw elements
  code = code.replace("Gr.tempGraphPosition.height),!Jr.toolClickStatus){var A=Nn.drawGraphPosition", "Gr.tempGraphPosition.height),(!Jr.toolClickStatus||Nn.draggingTrim)){var A=Nn.drawGraphPosition")
  code = code.replace("Nn.setCutOutBoxPosition(e,t,n,r)}}", "Nn.setCutOutBoxPosition(e,t,n,r);Gr.redrawCanvasElements()}}")

  code = code.replace("Gr.tempGraphPosition.height)){var A=Nn.drawGraphPosition", "Gr.tempGraphPosition.height),(!Jr.toolClickStatus||Nn.draggingTrim)){var A=Nn.drawGraphPosition")

  // 8. Text tool Zs: hit-test the cut box geometrically (mouseInsideCropBox lags / misses),
  // allow placing text over non-text drawings, and ALWAYS consume mousedown while text is active
  // so Ms()/draw cannot steal or dismiss #textInputPanel (upstream Boolean(t&&Zs) is inverted).
  code = code.replace(
    'function Zs(e,t,n){if(!Gr.mouseInsideCropBox)return!0;var r=n.textInputController,o=n.canvasContext,i=null;Gr.checkMouseInElement(e,t,function(A){i=A});var s=null!=i?Gr.getCanvasElement(i):null,a=Gr.activeElementId;if(function(A,e,t){var n=null!=e&&"text"!==e.type&&("move"===t||wr.has(t)),r=null!=A&&"text"!==A.type;return n||r}(s,null!=a?Gr.getCanvasElement(a):null,Gn.mousePointer))return!1;',
    'function Zs(e,t,n){var _b=Nn.cutOutBoxPosition;if(!(_b&&e>=_b.startX&&t>=_b.startY&&e<=_b.startX+_b.width&&t<=_b.startY+_b.height))return!0;var r=n.textInputController,o=n.canvasContext,i=null;Gr.checkMouseInElement(e,t,function(A){i=A});var s=null!=i?Gr.getCanvasElement(i):null,a=Gr.activeElementId;if(function(A,e,t){return null!=e&&"text"!==e.type&&("move"===t||wr.has(t))}(s,null!=a?Gr.getCanvasElement(a):null,Gn.mousePointer))return!1;'
  )
  // Idempotent if a previous Vessel run already applied the geometry gate but kept the old abort.
  code = code.replace(
    'function Zs(e,t,n){var _b=Nn.cutOutBoxPosition;if(!(_b&&e>=_b.startX&&t>=_b.startY&&e<=_b.startX+_b.width&&t<=_b.startY+_b.height))return!0;var r=n.textInputController,o=n.canvasContext,i=null;Gr.checkMouseInElement(e,t,function(A){i=A});var s=null!=i?Gr.getCanvasElement(i):null,a=Gr.activeElementId;if(function(A,e,t){var n=null!=e&&"text"!==e.type&&("move"===t||wr.has(t)),r=null!=A&&"text"!==A.type;return n||r}(s,null!=a?Gr.getCanvasElement(a):null,Gn.mousePointer))return!1;',
    'function Zs(e,t,n){var _b=Nn.cutOutBoxPosition;if(!(_b&&e>=_b.startX&&t>=_b.startY&&e<=_b.startX+_b.width&&t<=_b.startY+_b.height))return!0;var r=n.textInputController,o=n.canvasContext,i=null;Gr.checkMouseInElement(e,t,function(A){i=A});var s=null!=i?Gr.getCanvasElement(i):null,a=Gr.activeElementId;if(function(A,e,t){return null!=e&&"text"!==e.type&&("move"===t||wr.has(t))}(s,null!=a?Gr.getCanvasElement(a):null,Gn.mousePointer))return!1;'
  )
  code = code.replace(
    "function(A,e){var t=ks();return Boolean(t&&Zs(A,e,t))}",
    "function(A,e){var t=ks();if(!t)return!1;Zs(A,e,t);return!0}"
  )
  code = code.replace(
    "function(A,e){var t=ks();if(!t)return!1;return!Zs(A,e,t)}",
    "function(A,e){var t=ks();if(!t)return!1;Zs(A,e,t);return!0}"
  )

  // 9. Expose custom-element API for Vessel-owned text / shapes (addElement + history).
  code = code.replace(
    ",vs={addElement:function(e){",
    ",vs=globalThis.__vesselShotApi={addElement:function(e){"
  )
  code = code.replace(
    "redraw:function(){Qs()}},Us=function(A,e,t){var n;null===(n=Cs())||void 0===n||n.mouseDownFn(A,e,t,Wr,vs)}",
    "redraw:function(){Qs()},saveHistory:function(){Wr()}};globalThis.__vesselShotHistory=Wr;Us=function(A,e,t){var n;null===(n=Cs())||void 0===n||n.mouseDownFn(A,e,t,Wr,vs)}"
  )
  // Idempotent if a prior run already assigned __vesselShotApi but not saveHistory.
  code = code.replace(
    "redraw:function(){Qs()}},Us=function(A,e,t){var n;globalThis.__vesselShotHistory=Wr,null===(n=Cs())||void 0===n||n.mouseDownFn(A,e,t,Wr,vs)}",
    "redraw:function(){Qs()},saveHistory:function(){Wr()}};globalThis.__vesselShotHistory=Wr;Us=function(A,e,t){var n;null===(n=Cs())||void 0===n||n.mouseDownFn(A,e,t,Wr,vs)}"
  )

  if (code !== orig) {
    writeFileSync(filePath, code, "utf8")
    console.log("Patched screenshot plugin:", filePath)
  }
}

for (const target of targets) {
  patchFile(target)
}
