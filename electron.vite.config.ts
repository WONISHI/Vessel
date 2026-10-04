import { resolve } from "path"
import { cpSync, mkdirSync } from "node:fs"
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

export default defineConfig({
  main: {
    // Workspace 包导出 TS 源码，必须编译进产物，不能留给 Electron require。
    build: { externalizeDeps: { exclude: ["@vessel/obsidian", "@vessel/utils", "@vessel/react-router"] } },
    resolve: {
      alias: {
        "@main": resolve("src/main")
      }
    }
  },
  preload: {
    build: { externalizeDeps: { exclude: ["@vessel/obsidian", "@vessel/utils", "@vessel/react-router"] } },
    resolve: {
      alias: {
        "@main": resolve("src/main"),
        "@preload": resolve("src/preload")
      }
    }
  },
  renderer: {
    worker: { format: "es" },
    optimizeDeps: { exclude: ["wasm-onlyoffice-sdk"] },
    build: { rollupOptions: { input: { index: resolve("src/renderer/index.html"), office: resolve("src/renderer/office.html") } } },
    resolve: {
      alias: {
        "moment": momentCommonJS,
        "@renderer": resolve("src/renderer/src"),
        "@": resolve("src/renderer/src")
      }
    },
    plugins: [localOcrAssets(), localVditorAssets(), react(), svgr()]
  }
})
