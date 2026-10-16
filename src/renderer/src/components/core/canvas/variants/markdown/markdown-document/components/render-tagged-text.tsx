import { Badge } from "@/components/ui/badge"
import { type ReactNode } from "react"

/** Renders tagged text. */
export function renderTaggedText(text: string): ReactNode {
  const parts = text.split(/((?<![\p{L}\p{N}_])#[\p{L}\p{N}_-]+)/u)
  return parts.map((part, index) =>
    /^#[\p{L}\p{N}_-]+$/u.test(part) ? (
      <Badge
        key={index}
        asChild
        variant="secondary"
        className="mx-0.5 border-0 bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-green-700"
      >
        <span>{part}</span>
      </Badge>
    ) : (
      part
    )
  )
}
