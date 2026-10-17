import { Breadcrumb, BreadcrumbItem, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb"
import { WorkspaceContext } from "@/components/workspace/types/workspace"
import { Fragment, useContext } from "react"

/** Displays a Base's vault-relative location using the editor's breadcrumb geometry. */
export function BaseBreadcrumb({ root, path }: { root: string; path: string }) {
  const context = useContext(WorkspaceContext)
  const normalizedRoot = root.replace(/\\/g, "/").replace(/\/$/, "")
  const normalizedPath = path.replace(/\\/g, "/")
  const relative = normalizedPath.startsWith(normalizedRoot + "/") ? normalizedPath.slice(normalizedRoot.length + 1) : normalizedPath.replace(/^\.\//, "")
  const segments = [context?.workspace?.name || normalizedRoot.split("/").pop() || "工作区", ...relative.split("/").filter(Boolean)]
  return (
    <Breadcrumb
      className="shrink-0 border-b border-[#f0efed] bg-white px-4 pt-2 pb-1.5"
      aria-label="当前 Base 文件路径"
    >
      <BreadcrumbList className="text-xs">
        {segments.map((segment, index) => (
          <Fragment key={index}>
            {index > 0 && <BreadcrumbSeparator />}
            <BreadcrumbItem className="min-w-0">
              {index === segments.length - 1 ? (
                <BreadcrumbPage className="max-w-64 truncate">{segment}</BreadcrumbPage>
              ) : (
                <button
                  className="max-w-48 truncate text-stone-500 transition-colors hover:text-stone-800"
                  onClick={() => context?.expandDirectory?.(index === 0 ? root : normalizedRoot + "/" + segments.slice(1, index + 1).join("/"))}
                >
                  {segment}
                </button>
              )}
            </BreadcrumbItem>
          </Fragment>
        ))}
      </BreadcrumbList>
    </Breadcrumb>
  )
}
