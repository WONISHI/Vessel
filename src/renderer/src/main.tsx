import "./assets/main.css"

// 引入所有字重
import "@fontsource/plus-jakarta-sans"

// 或按需引入特定字重（推荐，减小体积）
import "@fontsource/plus-jakarta-sans/400.css" // Regular
import "@fontsource/plus-jakarta-sans/500.css" // Medium
import "@fontsource/plus-jakarta-sans/600.css" // SemiBold
import "@fontsource/plus-jakarta-sans/700.css" // Bold

// 斜体
import "@fontsource/plus-jakarta-sans/400-italic.css"

import { StrictMode } from "react"
import { createRoot } from "react-dom/client"
import App from "./App"

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
)
