import { createContext } from "react"
import { DEFAULT_SITE_COLOR } from "@/pages/browser/favicon-color"

// Context crosses Sheet portals without styling unrelated application panels.
export const BrowserSiteColorContext = createContext(DEFAULT_SITE_COLOR)
