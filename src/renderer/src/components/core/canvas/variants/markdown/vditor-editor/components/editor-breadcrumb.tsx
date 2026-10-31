import { Breadcrumb, BreadcrumbItem, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb"
import { Fragment } from "react"
import type { VditorEditorModel } from "@/components/core/canvas/variants/markdown/vditor-editor/types"

/** 当前文件路径面包屑 */
export function EditorBreadcrumb({ m }: { m: VditorEditorModel }) {
  const { workspacePath, documentPath, readOnly } = m

  return (
    <>
      {!readOnly && (
        <Breadcrumb
          className="shrink-0 px-4 pt-2"
          aria-label="当前文件路径"
        >
          <BreadcrumbList className="text-xs">
            {(() => {
              const normWorkspace = workspacePath.replace(/\\/g, "/")
              const normDoc = documentPath.replace(/\\/g, "/")
              const rootName = normWorkspace.split("/").filter(Boolean).pop() || "工作区"
              const segments = [{ name: rootName, path: workspacePath }]
              if (normWorkspace && normDoc.startsWith(normWorkspace)) {
                const rel = normDoc.slice(normWorkspace.length).replace(/^\/+/, "")
                let accumulated = normWorkspace
                for (const part of rel.split("/").filter(Boolean)) {
                  accumulated += "/" + part
                  segments.push({ name: part, path: accumulated })
                }
              }
              return segments.map((segment, index, parts) => {
                const isLast = index === parts.length - 1
                return (
                  <Fragment key={index}>
                    {index > 0 && <BreadcrumbSeparator />}
                    <BreadcrumbItem className="min-w-0">
                      {isLast ? (
                        <BreadcrumbPage
                          className="cursor-pointer truncate rounded-md px-1.5 py-0.5 max-w-64 hover:bg-stone-100 hover:text-stone-900 dark:hover:bg-white/[0.08] dark:hover:text-white transition-colors"
                          onClick={() => window.dispatchEvent(new CustomEvent("vessel:reveal-file", { detail: segment.path }))}
                        >
                          {segment.name}
                        </BreadcrumbPage>
                      ) : (
                        <span
                          className="cursor-pointer truncate rounded-md px-1.5 py-0.5 text-stone-500 hover:bg-stone-100 hover:text-stone-800 dark:hover:bg-white/[0.08] dark:hover:text-white transition-colors"
                          onClick={() => window.dispatchEvent(new CustomEvent("vessel:reveal-file", { detail: segment.path }))}
                        >
                          {segment.name}
                        </span>
                      )}
                    </BreadcrumbItem>
                  </Fragment>
                )
              })
            })()}
          </BreadcrumbList>
        </Breadcrumb>
      )}
    </>
  )
}
