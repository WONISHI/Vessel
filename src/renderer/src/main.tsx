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
import Logo from "@/assets/logo.png"
import DarkLogo from "@/assets/logo-dark.svg"

// 监听未捕获的致命运行时错误
window.addEventListener("error", (event) => {
  console.error("Window error caught:", event.error)
})

window.addEventListener("unhandledrejection", (event) => {
  console.error("Unhandled promise rejection:", event.reason)
})

installDataTitleTooltips()

// A standalone preview must not initialize the full workspace/router module graph.
const MainApplication = lazy(async () => {
  const [{ default: router }, { RouterProvider }] = await Promise.all([import("@/router/index"), import("@vessel/react-router/components")])
  return { default: () => <RouterProvider router={router} /> }
})
const StandalonePreview = lazy(() => import("@/components/transit/standalone-preview"))
const standalonePreview = new URLSearchParams(window.location.search).has("standalonePreview")

/** Mirrors the static splash in index.html (styles live there) so the boot → lazy-load handoff doesn't flash. */
function BootSplash() {
  return (
    <div className="boot-splash" role="status" aria-label="正在加载">
      <img className="boot-splash-light" src={Logo} alt="Vessel" />
      <img className="boot-splash-dark" src={DarkLogo} alt="" aria-hidden="true" />
      <div className="boot-splash-bar" />
    </div>
  )
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <GlobalErrorBoundary>
      <Suspense fallback={<BootSplash />}>{standalonePreview ? <StandalonePreview /> : <MainApplication />}</Suspense>
    </GlobalErrorBoundary>
  </StrictMode>
)
