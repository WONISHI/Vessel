import "@/assets/tailwind.css"
import { Editor, Office } from "@/features/office/components/index"
import { OfficeErrorBoundary } from "@/features/office/components/office-error-boundary"
import { createRoot } from "react-dom/client"

createRoot(document.getElementById("root")!).render(<OfficeErrorBoundary>{location.search.includes("editor=1") ? <Editor /> : <Office />}</OfficeErrorBoundary>)
