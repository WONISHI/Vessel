import { File } from "lucide-react"
import { FileThemeIcon } from "@/features/file-icons"
import { FileIconScope } from "@/features/file-icons/state"
import { getFilePresentation } from "@/components/workspace/components/layout-aside/layout-workspace-sidebar/utils"

/** Git files follow the project resource library's icon settings. */
export function GitFileIcon({ path, className = "size-3.5 shrink-0" }: { path: string; className?: string }) {
  return <FileIconScope.Provider value="resources">
    <FileThemeIcon name={path} className={`${className} object-contain`} fallback={<File className={`${className} ${getFilePresentation(path).color}`} />} />
  </FileIconScope.Provider>
}
