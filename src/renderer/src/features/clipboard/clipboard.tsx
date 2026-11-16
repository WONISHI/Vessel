import { createRoot } from "react-dom/client"
import { ClipboardPanel } from "./components/clipboard-panel"
import "./clipboard.css"

createRoot(document.getElementById("root")!).render(<ClipboardPanel />)
