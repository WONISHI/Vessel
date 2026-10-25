import { Breadcrumb, BreadcrumbItem, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb"
import { WorkspaceContext } from "@/components/workspace/types/workspace"
import { Fragment, useContext } from "react"
import { cn } from "@/lib/utils"

/** Displays a Base's vault-relative location using the editor's breadcrumb geometry. */
export function BaseBreadcrumb({ root, path, className, label = "当前 Base 文件路径" }: { root: string; path: string; className?: string; label?: string }) {
  const context = useContext(WorkspaceContext)
  const normalizedRoot = root.replace(/\\/g, "/").replace(/\/$/, "")
  const normalizedPath = path.replace(/\\/g, "/")
  const relative = normalizedPath.startsWith(normalizedRoot + "/") ? normalizedPath.slice(normalizedRoot.length + 1) : normalizedPath.replace(/^\.\//, "")
  const segments = [context?.workspace?.name || normalizedRoot.split("/").pop() || "工作区", ...relative.split("/").filter(Boolean)]
  return (
    <Breadcrumb
      className={cn("shrink-0 border-b border-[#f0efed] bg-white px-4 pt-2 pb-1.5", className)}
      aria-label={label}
    >
      <BreadcrumbList className="text-xs">
        {segments.map((segment, index) => (
          <Fragment key={index}>
            {index > 0 && <BreadcrumbSeparator />}
            <BreadcrumbItem className="min-w-0">
              {index === segments.length - 1 ? (
                <BreadcrumbPage
                  aria-disabled={false}
                  className="max-w-64 truncate"
                >
                  <button
                    className="cursor-pointer truncate rounded-md px-1.5 py-0.5 transition-colors hover:bg-stone-100 hover:text-stone-900 dark:hover:bg-white/[0.08] dark:hover:text-white"
                    onClick={() => window.dispatchEvent(new CustomEvent("vessel:reveal-file", { detail: normalizedRoot + "/" + segments.slice(1).join("/") }))}
                  >
                    {segment}
                  </button>
                </BreadcrumbPage>
              ) : (
                <button
                  className="max-w-48 cursor-pointer truncate rounded-md px-1.5 py-0.5 text-stone-500 transition-colors hover:bg-stone-100 hover:text-stone-800 dark:hover:bg-white/[0.08] dark:hover:text-white"
                  onClick={() => window.dispatchEvent(new CustomEvent("vessel:reveal-file", { detail: index === 0 ? root : normalizedRoot + "/" + segments.slice(1, index + 1).join("/") }))}
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
