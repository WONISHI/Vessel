import react from "@vitejs/plugin-react"
import { defineConfig } from "electron-vite"
import { execFileSync } from "node:child_process"
import { cpSync, mkdirSync, statSync } from "node:fs"
import { createRequire } from "node:module"
import { resolve } from "path"
import svgr from "vite-plugin-svgr"
import { fileURLToPath } from "node:url"

const projectRoot = fileURLToPath(new URL(".", import.meta.url))

/** Resolves build inputs and aliases from this config file, independent of the launching directory. */
function resolveFromRoot(...paths: string[]): string {
  return resolve(projectRoot, ...paths)
}

// react-moment's CommonJS duration plugin expects the Moment function, not an ESM namespace.
const clockRequire = createRequire(createRequire(import.meta.url).resolve("react-live-clock"))
const momentCommonJS = clockRequire.resolve("moment/moment.js")

/** Keep local assets offline without rewriting unchanged files on every build. */
function copyLocalAssets(source: string, destination: string) {
  cpSync(source, destination, {
    recursive: true,
    preserveTimestamps: true,
    filter(from, to) {
      const input = statSync(from)
      if (input.isDirectory()) return true
      try {
        const output = statSync(to)
        return input.size !== output.size || Math.abs(input.mtimeMs - output.mtimeMs) >= 1
      } catch {
        return true
      }
    }
  })
}

/** 将已安装版本的编辑器资源放入 public，供开发服务和打包后的 file:// 页面共同使用。 */
function localVditorAssets() {
  return {
    name: "vessel-local-vditor-assets",
    configResolved() {
      const require = createRequire(import.meta.url)
      const source = resolveFromRoot(require.resolve("vditor/package.json"), "../dist")
      const destination = resolveFromRoot("src/renderer/public/vendor/vditor/dist")
      mkdirSync(destination, { recursive: true })
      copyLocalAssets(source, destination)
    }
  }
}

function localMattingAssets() {
  return {
    name: "vessel-local-matting-assets",
    configResolved() {
      // Fail before packaging if the offline runtime is incomplete. Never fetch at runtime.
      execFileSync(process.execPath, [resolveFromRoot("scripts/prepare-matting-assets.cjs"), "--check"], { stdio: "inherit", cwd: projectRoot })
    }
  }
}

function localOcrAssets() {
  return {
    name: "vessel-local-ocr-assets",
    configResolved() {
      const require = createRequire(import.meta.url)
      const source = resolveFromRoot(require.resolve("onnxruntime-web"), "..")
      const destination = resolveFromRoot("src/renderer/public/ocr/runtime")
      mkdirSync(destination, { recursive: true })
      for (const file of ["ort-wasm-simd-threaded.mjs", "ort-wasm-simd-threaded.wasm"]) {
        copyLocalAssets(resolveFromRoot(source, file), resolveFromRoot(destination, file))
      }
    }
  }
}

function patchScreenShotPlugin() {
  return {
    name: "vessel-patch-screenshot-plugin",
    enforce: "pre" as const,
    transform(code: string, id: string) {
      if (!id.includes("js-web-screen-shot")) return null
      let patched = code
      // Round white selection handles and a thin blue outline; keep original hit areas.
      patched = patched.replace("var h=o;r.fillRect(A-h/2,e-h/2,h,h),r.fillRect(A-h/2+t/2,e-h/2,h,h),r.fillRect(A-h/2+t,e-h/2,h,h),r.fillRect(A-h/2,e-h/2+n/2,h,h),r.fillRect(A-h/2+t,e-h/2+n/2,h,h),r.fillRect(A-h/2,e-h/2+n,h,h),r.fillRect(A-h/2+t/2,e-h/2+n,h,h),r.fillRect(A-h/2+t,e-h/2+n,h,h)", "r.strokeStyle=Hn.cutBoxBdColor,r.lineWidth=1,r.strokeRect(A,e,t,n),Wn(A,e,t,n).forEach(function(P){r.beginPath(),r.arc(P.x,P.y,3.5,0,2*Math.PI),r.fillStyle=\"#ffffff\",r.fill(),r.strokeStyle=\"#c7c9cc\",r.lineWidth=1,r.stroke()})")
      patched = patched.replace("setToolStatus(!0);var i=o.cutOutBoxPosition;Jn(i.startX,i.startY,i.width,i.height,A,o.borderSize,e,t,!1)", "setToolStatus(!0);var i=o.cutOutBoxPosition;Jn(i.startX,i.startY,i.width,i.height,A,o.borderSize,e,t,!0)")
      patched = patched.replace("var i=Nn.cutOutBoxPosition;Jn(i.startX,i.startY,i.width,i.height,A,Nn.borderSize,r,o,!1)", "var i=Nn.cutOutBoxPosition;Jn(i.startX,i.startY,i.width,i.height,A,Nn.borderSize,r,o,!0)")
      patched = patched.replace("Gr.selectionBorderNodes.length>0&&!Jr.toolClickStatus&&!Nn.draggingTrim&&ys(A,e,i)", "Gr.selectionBorderNodes.length>0&&!Nn.draggingTrim&&ys(A,e,i)")
      // Skip crop Move while drawing; keep Move for text (mouseInsideCropBox). On text+Move hits
      // clear borderOption so Ms()/mouseUp crop-drag cannot destroy #textInputPanel.
      patched = patched.replace(
        /if\s*\(\s*Jr\.toolClickStatus\s*&&\s*(\w+)\.option\s*===\s*lo\.Move\s*\)\s*continue\s*;/g,
        'if(Jr.toolClickStatus&&$1.option===lo.Move&&"text"!==Jr.toolName)continue;'
      )
      patched = patched.replace(
        /if\s*\(\s*Jr\.toolClickStatus\s*&&\s*(\w+)\.option\s*===\s*lo\.Move\s*&&\s*"text"\s*!==\s*Jr\.toolName\s*\)\s*continue\s*;/g,
        'if(Jr.toolClickStatus&&$1.option===lo.Move&&"text"!==Jr.toolName)continue;'
      )
      patched = patched.replace(
        "for(var r=0;r<Gr.selectionBorderNodes.length;r++){var o=Gr.selectionBorderNodes[r];if(t.rect(o.x,o.y,o.width,o.height)",
        'for(var r=0;r<Gr.selectionBorderNodes.length;r++){var o=Gr.selectionBorderNodes[r];if(Jr.toolClickStatus&&o.option===lo.Move&&"text"!==Jr.toolName)continue;if(t.rect(o.x,o.y,o.width,o.height)'
      )
      patched = patched.replace(
        /Fs\((\w+)\.index\)\s*,\s*Gr\.updateBorderOption\(\1\.option\)\s*,\s*(\w+)=!0/g,
        'Fs($1.index),Jr.toolClickStatus&&$1.option===lo.Move&&"text"===Jr.toolName?Gr.updateBorderOption(null):Gr.updateBorderOption($1.option),$2=!0'
      )
      patched = patched.replace(
        /Fs\((\w+)\.index\)\s*,\s*Gr\.updateBorderOption\(\1\.option\)\s*,\s*(\w+)\s*=\s*true/g,
        'Fs($1.index),Jr.toolClickStatus&&$1.option===lo.Move&&"text"===Jr.toolName?Gr.updateBorderOption(null):Gr.updateBorderOption($1.option),$2=true'
      )
      patched = patched.replace("!Jr.toolClickStatus||Nn.dragging?Jr.toolClickStatus&&Nn.dragging?Vs(", "!Jr.toolClickStatus||Nn.dragging?Jr.toolClickStatus&&Nn.dragging&&!Nn.draggingTrim?Vs(")
      patched = patched.replace("bs()&&(Is(t),Hs(t,n)||(Ss(),xs(),Ks(A)&&Ds(e)))", "bs()&&(Is(t),Gr.borderOption?(Ss(),xs(),Ds(e),Gr.updateBorderOption(null)):(Hs(t,n)||(Ss(),xs(),Ks(A)&&Ds(e))))")
      patched = patched.replace("Gr.tempGraphPosition.height),!Jr.toolClickStatus){var A=Nn.drawGraphPosition", "Gr.tempGraphPosition.height),(!Jr.toolClickStatus||Nn.draggingTrim)){var A=Nn.drawGraphPosition")
      patched = patched.replace("Nn.setCutOutBoxPosition(e,t,n,r)}}", "Nn.setCutOutBoxPosition(e,t,n,r);Gr.redrawCanvasElements()}}")
      patched = patched.replace("Gr.tempGraphPosition.height)){var A=Nn.drawGraphPosition", "Gr.tempGraphPosition.height),(!Jr.toolClickStatus||Nn.draggingTrim)){var A=Nn.drawGraphPosition")

      // Text tool Zs: geometric cut-box hit (mouseInsideCropBox is unreliable), allow text over
      // shapes, and always consume mousedown while text is active so Ms()/draw cannot steal the panel.
      patched = patched.replace(
        'function Zs(e,t,n){if(!Gr.mouseInsideCropBox)return!0;var r=n.textInputController,o=n.canvasContext,i=null;Gr.checkMouseInElement(e,t,function(A){i=A});var s=null!=i?Gr.getCanvasElement(i):null,a=Gr.activeElementId;if(function(A,e,t){var n=null!=e&&"text"!==e.type&&("move"===t||wr.has(t)),r=null!=A&&"text"!==A.type;return n||r}(s,null!=a?Gr.getCanvasElement(a):null,Gn.mousePointer))return!1;',
        'function Zs(e,t,n){var _b=Nn.cutOutBoxPosition;if(!(_b&&e>=_b.startX&&t>=_b.startY&&e<=_b.startX+_b.width&&t<=_b.startY+_b.height))return!0;var r=n.textInputController,o=n.canvasContext,i=null;Gr.checkMouseInElement(e,t,function(A){i=A});var s=null!=i?Gr.getCanvasElement(i):null,a=Gr.activeElementId;if(function(A,e,t){return null!=e&&"text"!==e.type&&("move"===t||wr.has(t))}(s,null!=a?Gr.getCanvasElement(a):null,Gn.mousePointer))return!1;'
      )
      patched = patched.replace(
        'function Zs(e,t,n){var _b=Nn.cutOutBoxPosition;if(!(_b&&e>=_b.startX&&t>=_b.startY&&e<=_b.startX+_b.width&&t<=_b.startY+_b.height))return!0;var r=n.textInputController,o=n.canvasContext,i=null;Gr.checkMouseInElement(e,t,function(A){i=A});var s=null!=i?Gr.getCanvasElement(i):null,a=Gr.activeElementId;if(function(A,e,t){var n=null!=e&&"text"!==e.type&&("move"===t||wr.has(t)),r=null!=A&&"text"!==A.type;return n||r}(s,null!=a?Gr.getCanvasElement(a):null,Gn.mousePointer))return!1;',
        'function Zs(e,t,n){var _b=Nn.cutOutBoxPosition;if(!(_b&&e>=_b.startX&&t>=_b.startY&&e<=_b.startX+_b.width&&t<=_b.startY+_b.height))return!0;var r=n.textInputController,o=n.canvasContext,i=null;Gr.checkMouseInElement(e,t,function(A){i=A});var s=null!=i?Gr.getCanvasElement(i):null,a=Gr.activeElementId;if(function(A,e,t){return null!=e&&"text"!==e.type&&("move"===t||wr.has(t))}(s,null!=a?Gr.getCanvasElement(a):null,Gn.mousePointer))return!1;'
      )
      patched = patched.replace(
        "function(A,e){var t=ks();return Boolean(t&&Zs(A,e,t))}",
        "function(A,e){var t=ks();if(!t)return!1;Zs(A,e,t);return!0}"
      )
      patched = patched.replace(
        "function(A,e){var t=ks();if(!t)return!1;return!Zs(A,e,t)}",
        "function(A,e){var t=ks();if(!t)return!1;Zs(A,e,t);return!0}"
      )
      patched = patched.replace(
        /function\s*\(\s*(\w+)\s*,\s*(\w+)\s*\)\s*\{\s*var\s+(\w+)\s*=\s*ks\(\)\s*;\s*return\s+Boolean\(\s*\3\s*&&\s*Zs\(\s*\1\s*,\s*\2\s*,\s*\3\s*\)\s*\)\s*;?\s*\}/g,
        "function($1,$2){var $3=ks();if(!$3)return!1;Zs($1,$2,$3);return!0}"
      )
      patched = patched.replace(
        /function\s*\(\s*(\w+)\s*,\s*(\w+)\s*\)\s*\{\s*var\s+(\w+)\s*=\s*ks\(\)\s*;\s*if\s*\(\s*!\3\s*\)\s*return\s*!1\s*;\s*return\s*!Zs\(\s*\1\s*,\s*\2\s*,\s*\3\s*\)\s*;?\s*\}/g,
        "function($1,$2){var $3=ks();if(!$3)return!1;Zs($1,$2,$3);return!0}"
      )


      // Expose plugin custom-element API for Vessel-owned text commits.
      patched = patched.replace(
        ",vs={addElement:function(e){",
        ",vs=globalThis.__vesselShotApi={addElement:function(e){"
      )
      patched = patched.replace(
        "var vs = { addElement: function(e2) {",
        "var vs = globalThis.__vesselShotApi = { addElement: function(e2) {"
      )
      // Keep Us in the comma-assignment chain — a ";" before Us= breaks ESM strict init.
      patched = patched.replace(
        "redraw:function(){Qs()}},Us=function(A,e,t){var n;null===(n=Cs())||void 0===n||n.mouseDownFn(A,e,t,Wr,vs)}",
        "redraw:function(){Qs()},saveHistory:function(){Wr()}},Us=(globalThis.__vesselShotHistory=Wr,function(A,e,t){var n;null===(n=Cs())||void 0===n||n.mouseDownFn(A,e,t,Wr,vs)})"
      )
      patched = patched.replace(
        "redraw:function(){Qs()},saveHistory:function(){Wr()}};globalThis.__vesselShotHistory=Wr;Us=function(A,e,t){var n;null===(n=Cs())||void 0===n||n.mouseDownFn(A,e,t,Wr,vs)}",
        "redraw:function(){Qs()},saveHistory:function(){Wr()}},Us=(globalThis.__vesselShotHistory=Wr,function(A,e,t){var n;null===(n=Cs())||void 0===n||n.mouseDownFn(A,e,t,Wr,vs)})"
      )
      patched = patched.replace(
        "redraw: function() {\n  Qs();\n} };",
        "redraw: function() {\n  Qs();\n  }, saveHistory: function() {\n    Wr();\n  } };\nglobalThis.__vesselShotHistory = Wr;"
      )

      return { code: patched, map: null }
    }
  }
}

export default defineConfig({
  main: {
    root: projectRoot,
    // Workspace 包导出 TS 源码，必须编译进产物，不能留给 Electron require。
    build: {
      rollupOptions: { input: { index: resolveFromRoot("src/main/index.ts"), "code-diagnostics-worker": resolveFromRoot("src/main/diagnostics/code-diagnostics-worker.ts") } },
      externalizeDeps: { exclude: ["@vessel/obsidian", "@vessel/utils", "@vessel/react-router", "@vessel/sync", "@vessel/type"] }
    },
    resolve: {
      alias: {
        "@resources": resolveFromRoot("resources"),
        "#vessel-clipper": resolveFromRoot("packages/@vessel/clipper/src"),
        "#vessel-obsidian": resolveFromRoot("packages/@vessel/obsidian/src"),
        "#vessel-react-router": resolveFromRoot("packages/@vessel/react-router/src"),
        "#vessel-sync": resolveFromRoot("packages/@vessel/sync/src"),
        "#vessel-type": resolveFromRoot("packages/@vessel/type/src"),
        "#vessel-utils": resolveFromRoot("packages/@vessel/utils/src"),
        "@vessel/sync": resolveFromRoot("packages/@vessel/sync/src/index.ts"),
        "@main": resolveFromRoot("src/main")
      }
    }
  },
  preload: {
    root: projectRoot,
    build: {
      rollupOptions: { input: { index: resolveFromRoot("src/preload/index.ts"), screenshot: resolveFromRoot("src/preload/screenshot.ts"), "browser-guest": resolveFromRoot("src/preload/browser-guest.ts") } },
      externalizeDeps: { exclude: ["@electron-toolkit/preload", "@vessel/obsidian", "@vessel/utils", "@vessel/react-router", "@vessel/sync", "@vessel/type"] }
    },
    resolve: {
      alias: {
        "@resources": resolveFromRoot("resources"),
        "#vessel-clipper": resolveFromRoot("packages/@vessel/clipper/src"),
        "#vessel-obsidian": resolveFromRoot("packages/@vessel/obsidian/src"),
        "#vessel-react-router": resolveFromRoot("packages/@vessel/react-router/src"),
        "#vessel-sync": resolveFromRoot("packages/@vessel/sync/src"),
        "#vessel-type": resolveFromRoot("packages/@vessel/type/src"),
        "#vessel-utils": resolveFromRoot("packages/@vessel/utils/src"),
        "@vessel/sync": resolveFromRoot("packages/@vessel/sync/src/index.ts"),
        "@main": resolveFromRoot("src/main"),
        "@preload": resolveFromRoot("src/preload")
      }
    }
  },
  renderer: {
    root: resolveFromRoot("src/renderer"),
    define: {
      "process.env.IS_PREACT": JSON.stringify("false")
    },
    worker: { format: "es" },
    optimizeDeps: { exclude: ["wasm-onlyoffice-sdk", "@vessel/obsidian"] },
    build: { minify: "esbuild", reportCompressedSize: false, rollupOptions: { input: { index: resolveFromRoot("src/renderer/index.html"), office: resolveFromRoot("src/renderer/office.html"), screenshot: resolveFromRoot("src/renderer/screenshot.html") } } },
    resolve: {
      dedupe: ["react", "react-dom"],
      alias: [
        // IMG.LY runs on CPU and supplies its own wasm URLs; the WASM-only build avoids shipping an unused 23MB JSEP/WebGPU wasm.
        { find: /^onnxruntime-web(\/webgpu)?$/, replacement: "onnxruntime-web/wasm" },
        { find: /^@vessel\/obsidian\/callouts\/style\.css/, replacement: resolveFromRoot("packages/@vessel/obsidian/src/callouts/style.css") },
      { find: /^@vessel\/obsidian$/, replacement: resolveFromRoot("packages/@vessel/obsidian/src/index.ts") },
        ...Object.entries({
        "@resources": resolveFromRoot("resources"),
        "#vessel-clipper": resolveFromRoot("packages/@vessel/clipper/src"),
        "#vessel-obsidian": resolveFromRoot("packages/@vessel/obsidian/src"),
        "#vessel-react-router": resolveFromRoot("packages/@vessel/react-router/src"),
        "#vessel-sync": resolveFromRoot("packages/@vessel/sync/src"),
        "#vessel-type": resolveFromRoot("packages/@vessel/type/src"),
        "#vessel-utils": resolveFromRoot("packages/@vessel/utils/src"),
        moment: momentCommonJS,
        "@renderer": resolveFromRoot("src/renderer/src"),
        "@": resolveFromRoot("src/renderer/src")
        }).map(([find, replacement]) => ({ find, replacement }))
      ]
    },
    plugins: [localMattingAssets(), localOcrAssets(), localVditorAssets(), patchScreenShotPlugin(), react(), svgr()]
  }
})
