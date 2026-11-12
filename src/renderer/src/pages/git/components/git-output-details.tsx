import { ScrollArea } from "@/components/ui/scroll-area"
import { TextWithArrows } from "@/components/ui/text-with-arrows"

/** Keeps verbose Git output collapsed inside operation notifications. */
export function GitOutputDetails({ output }: { output: string }) {
  return (
    <details className="min-w-0 w-full">
      <summary className="cursor-pointer py-1 text-xs text-muted-foreground">查看操作详情</summary>
      <ScrollArea className="mt-2 h-48 w-full [&_[data-radix-scroll-area-viewport]>div]:!block">
        <div className="pr-3 text-xs [overflow-wrap:anywhere]"><TextWithArrows text={output} /></div>
      </ScrollArea>
    </details>
  )
}
