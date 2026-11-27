import { Skeleton } from './skeleton'

/** Preserve the tool's page geometry while its route or editor is being prepared. */
export function PageSkeleton({ editorOnly = false }: { editorOnly?: boolean }) {
  return <div role="status" aria-label="正在加载页面" data-page-transition-loading className="flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden bg-background">
    {!editorOnly && <>
      <div className="flex shrink-0 items-center gap-3 border-b px-6 py-5" aria-hidden="true">
        <Skeleton className="size-10 shrink-0 rounded-xl" />
        <div className="flex flex-1 flex-col gap-2"><Skeleton className="h-5 w-32" /><Skeleton className="h-3 w-56 max-w-full" /></div>
        <Skeleton className="hidden h-9 w-24 sm:block" /><Skeleton className="h-9 w-24" />
      </div>
      <div className="flex shrink-0 gap-3 border-b px-6 py-3" aria-hidden="true"><Skeleton className="h-7 w-28" /><Skeleton className="h-7 w-20" /></div>
    </>}
    <div className="min-h-0 flex-1 space-y-4 overflow-hidden p-6" aria-hidden="true">
      {Array.from({ length: 12 }, (_, index) => <div key={index} className="flex items-center gap-5">
        <Skeleton className="h-3 w-4 shrink-0" />
        <Skeleton className="h-3" style={{ width: `${[42, 68, 54, 76, 35, 60][index % 6]}%` }} />
      </div>)}
    </div>
  </div>
}
