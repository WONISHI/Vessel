import "./assets/main.css"

import "@fontsource/plus-jakarta-sans"
import "@fontsource/plus-jakarta-sans/400.css"
import "@fontsource/plus-jakarta-sans/500.css"
import "@fontsource/plus-jakarta-sans/600.css"
import "@fontsource/plus-jakarta-sans/700.css"
import "@fontsource/plus-jakarta-sans/400-italic.css"

import { StrictMode } from "react"
import { createRoot } from "react-dom/client"

import router from "./router"
import { RouterProvider } from "@/lib/react-router/components"

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>
)
