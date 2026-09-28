import { resolve } from "path"
import { cpSync, mkdirSync } from "node:fs"
import { createRequire } from "node:module"
import { defineConfig } from "electron-vite"
import react from "@vitejs/plugin-react"
import svgr from "vite-plugin-svgr"

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
    resolve: {
      alias: {
        "@renderer": resolve("src/renderer/src"),
        "@": resolve("src/renderer/src")
      }
    },
    plugins: [localVditorAssets(), react(), svgr()]
  }
})
