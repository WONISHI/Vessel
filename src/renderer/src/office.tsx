import { createRoot } from "react-dom/client"
import { Editor, Office } from "./office-components"
import "./assets/tailwind.css"
createRoot(document.getElementById("root")!).render(location.search.includes("editor=1") ? <Editor /> : <Office />)
