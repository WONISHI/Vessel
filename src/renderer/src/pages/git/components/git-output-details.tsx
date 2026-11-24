import { ScrollArea } from "@/components/ui/scroll-area"
import { TextWithArrows } from "@/components/ui/text-with-arrows"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { ChevronRight } from "lucide-react"

/** Keeps verbose Git output collapsed inside operation notifications. */
export function GitOutputDetails({ output }: { output: string }) {
  return (
    <Collapsible className="min-w-0 w-full">
      <CollapsibleTrigger className="group flex items-center gap-1 py-1 text-xs text-muted-foreground hover:text-foreground">
        <ChevronRight className="size-3.5 transition-transform group-data-[state=open]:rotate-90" />查看操作详情
      </CollapsibleTrigger>
      <CollapsibleContent className="overflow-hidden">
        <ScrollArea aria-label="Git 操作输出" className="mt-1 h-40 w-full rounded-md border bg-muted/30 p-2 [&_[data-radix-scroll-area-viewport]>div]:!block">
          <div className="whitespace-pre-wrap pr-2 font-mono text-[11px] leading-5 [overflow-wrap:anywhere]"><TextWithArrows text={output} /></div>
        </ScrollArea>
      </CollapsibleContent>
    </Collapsible>
  )
}
