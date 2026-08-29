import { resolve } from "path"
import { defineConfig } from "electron-vite"
import react from "@vitejs/plugin-react"

export default defineConfig({
  main: {
    resolve: {
      alias: {
        "@main": resolve("src/main")
      }
    }
  },
  preload: {
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
    plugins: [react()]
  }
})
