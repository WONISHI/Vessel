import { resolve } from "path"
import { cpSync, mkdirSync } from "node:fs"
import { execFileSync } from "node:child_process"
import { createRequire } from "node:module"
import { defineConfig } from "electron-vite"
import react from "@vitejs/plugin-react"
import svgr from "vite-plugin-svgr"

// react-moment's CommonJS duration plugin expects the Moment function, not an ESM namespace.
const clockRequire = createRequire(createRequire(import.meta.url).resolve("react-live-clock"))
const momentCommonJS = clockRequire.resolve("moment/moment.js")

/** 将已安装版本的编辑器资源放入 public，供开发服务和打包后的 file:// 页面共同使用。 */
function localVditorAssets() {
  return {
    name: "vessel-local-vditor-assets",
    configResolved() {
      const require = createRequire(import.meta.url)
      const source = resolve(require.resolve("vditor/package.json"), "../dist")
      const destination = resolve("src/renderer/public/vendor/vditor/dist")
      mkdirSync(destination, { recursive: true })
      cpSync(source, destination, { recursive: true })
    }
  }
}

function localMattingAssets() {
  return {
    name: "vessel-local-matting-assets",
    configResolved() {
      // Fail before packaging if the offline runtime is incomplete. Never fetch at runtime.
      execFileSync(process.execPath, [resolve("scripts/prepare-matting-assets.cjs"), "--check"], { stdio: "inherit" })
    }
  }
}

function localOcrAssets() {
  return {
    name: "vessel-local-ocr-assets",
    configResolved() {
      const require = createRequire(import.meta.url)
      const source = resolve(require.resolve("onnxruntime-web"), "..")
      const destination = resolve("src/renderer/public/ocr/runtime")
      mkdirSync(destination, { recursive: true })
      for (const file of ["ort-wasm-simd-threaded.mjs", "ort-wasm-simd-threaded.wasm"]) {
        cpSync(resolve(source, file), resolve(destination, file))
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
      patched = patched.replace(
        "setToolStatus(!0);var i=o.cutOutBoxPosition;Jn(i.startX,i.startY,i.width,i.height,A,o.borderSize,e,t,!1)",
        "setToolStatus(!0);var i=o.cutOutBoxPosition;Jn(i.startX,i.startY,i.width,i.height,A,o.borderSize,e,t,!0)"
      )
      patched = patched.replace(
        "var i=Nn.cutOutBoxPosition;Jn(i.startX,i.startY,i.width,i.height,A,Nn.borderSize,r,o,!1)",
        "var i=Nn.cutOutBoxPosition;Jn(i.startX,i.startY,i.width,i.height,A,Nn.borderSize,r,o,!0)"
      )
      patched = patched.replace(
        "Gr.selectionBorderNodes.length>0&&!Jr.toolClickStatus&&!Nn.draggingTrim&&ys(A,e,i)",
        "Gr.selectionBorderNodes.length>0&&!Nn.draggingTrim&&ys(A,e,i)"
      )
      patched = patched.replace(
        "for(var r=0;r<Gr.selectionBorderNodes.length;r++){var o=Gr.selectionBorderNodes[r];if(t.rect(o.x,o.y,o.width,o.height)",
        "for(var r=0;r<Gr.selectionBorderNodes.length;r++){var o=Gr.selectionBorderNodes[r];if(Jr.toolClickStatus&&o.option===lo.Move)continue;if(t.rect(o.x,o.y,o.width,o.height)"
      )
      patched = patched.replace(
        "!Jr.toolClickStatus||Nn.dragging?Jr.toolClickStatus&&Nn.dragging?Vs(",
        "!Jr.toolClickStatus||Nn.dragging?Jr.toolClickStatus&&Nn.dragging&&!Nn.draggingTrim?Vs("
      )
      patched = patched.replace(
        "bs()&&(Is(t),Hs(t,n)||(Ss(),xs(),Ks(A)&&Ds(e)))",
        "bs()&&(Is(t),Gr.borderOption?(Ss(),xs(),Ds(e),Gr.updateBorderOption(null)):(Hs(t,n)||(Ss(),xs(),Ks(A)&&Ds(e))))"
      )
      patched = patched.replace(
        "Gr.tempGraphPosition.height),!Jr.toolClickStatus){var A=Nn.drawGraphPosition",
        "Gr.tempGraphPosition.height)){var A=Nn.drawGraphPosition"
      )
      patched = patched.replace(
        "Nn.setCutOutBoxPosition(e,t,n,r)}}",
        "Nn.setCutOutBoxPosition(e,t,n,r);Gr.redrawCanvasElements()}}"
      )
      return { code: patched, map: null }
    }
  }
}

export default defineConfig({
  main: {
    // Workspace 包导出 TS 源码，必须编译进产物，不能留给 Electron require。
    build: { rollupOptions: { input: { index: resolve("src/main/index.ts"), "code-diagnostics-worker": resolve("src/main/code-diagnostics-worker.ts") } }, externalizeDeps: { exclude: ["@vessel/obsidian", "@vessel/utils", "@vessel/react-router", "@vessel/sync", "@vessel/type"] } },
    resolve: {
      alias: {
        "@vessel/sync": resolve("packages/sync/src/index.ts"),
        "@vessel/type": resolve("packages/type/src/index.ts"),
        "@vessel/utils": resolve("packages/utils/src/index.ts"),
        "@main": resolve("src/main")
      }
    }
  },
  preload: {
    build: { rollupOptions: { input: {index: resolve("src/preload/index.ts"), screenshot: resolve("src/preload/screenshot.ts"), "browser-guest": resolve("src/preload/browser-guest.ts")} }, externalizeDeps: { exclude: ["@vessel/obsidian", "@vessel/utils", "@vessel/react-router", "@vessel/sync", "@vessel/type"] } },
    resolve: {
      alias: {
        "@vessel/sync": resolve("packages/sync/src/index.ts"),
        "@vessel/type": resolve("packages/type/src/index.ts"),
        "@vessel/utils": resolve("packages/utils/src/index.ts"),
        "@main": resolve("src/main"),
        "@preload": resolve("src/preload")
      }
    }
  },
  renderer: {
    define: {
      "process.env.IS_PREACT": JSON.stringify("false")
    },
    worker: { format: "es" },
    optimizeDeps: { exclude: ["wasm-onlyoffice-sdk"] },
    build: { rollupOptions: { input: { index: resolve("src/renderer/index.html"), office: resolve("src/renderer/office.html"), screenshot: resolve("src/renderer/screenshot.html") } } },
    resolve: {
      alias: {
        "moment": momentCommonJS,
        "@vessel/type": resolve("packages/type/src/index.ts"),
        "@vessel/utils": resolve("packages/utils/src/index.ts"),
        "@renderer": resolve("src/renderer/src"),
        "@": resolve("src/renderer/src")
      }
    },
    plugins: [localMattingAssets(), localOcrAssets(), localVditorAssets(), patchScreenShotPlugin(), react(), svgr()]
  }
})
