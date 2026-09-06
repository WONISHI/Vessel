import "./assets/main.css"

import "@fontsource/plus-jakarta-sans"

import "@fontsource/plus-jakarta-sans/400.css" // Regular
import "@fontsource/plus-jakarta-sans/500.css" // Medium
import "@fontsource/plus-jakarta-sans/600.css" // SemiBold
import "@fontsource/plus-jakarta-sans/700.css" // Bold

import "@fontsource/plus-jakarta-sans/400-italic.css"

import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import { RouterProvider } from "@/lib/react-router/components"
import router from "./router"

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>
)
