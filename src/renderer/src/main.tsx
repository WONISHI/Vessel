import { installDataTitleTooltips } from "@/components/ui/data-title-tooltip"
import "@/assets/main.css"

import "@fontsource/plus-jakarta-sans"
import "@fontsource/plus-jakarta-sans/400-italic.css"
import "@fontsource/plus-jakarta-sans/400.css"
import "@fontsource/plus-jakarta-sans/500.css"
import "@fontsource/plus-jakarta-sans/600.css"
import "@fontsource/plus-jakarta-sans/700.css"

import { StrictMode, lazy, Suspense } from "react"
import { createRoot } from "react-dom/client"

import { GlobalErrorBoundary } from "@/components/core/error-boundary/crash-fallback"
import router from "@/router/index"
import { RouterProvider } from "@vessel/react-router/components"

// 监听未捕获的致命运行时错误
window.addEventListener("error", (event) => {
  console.error("Window error caught:", event.error)
})

window.addEventListener("unhandledrejection", (event) => {
  console.error("Unhandled promise rejection:", event.reason)
})

installDataTitleTooltips()

const StandalonePreview = lazy(() => import("@/components/transit/standalone-preview"))
const standalonePreview = new URLSearchParams(window.location.search).has("standalonePreview")

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <GlobalErrorBoundary>
      {standalonePreview ? <Suspense fallback={null}><StandalonePreview /></Suspense> : <RouterProvider router={router} />}
    </GlobalErrorBoundary>
  </StrictMode>
)
