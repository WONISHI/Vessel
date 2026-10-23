import { ArrowRight } from "lucide-react"
import { Fragment } from "react"

/** Keep Git arrow icons vertically centered with their surrounding text. */
export function TextWithArrows({ text }: { text: string }) {
  return (
    <span className="inline-flex max-w-full flex-wrap items-center gap-x-0.5 align-middle">
      {text.split("->").map((part, index) => (
        <Fragment key={index}>
          {index > 0 && <ArrowRight aria-label="指向" className="size-3 shrink-0 self-center" />}
          <span className="min-w-0 whitespace-pre-wrap break-words">{part}</span>
        </Fragment>
      ))}
    </span>
  )
}
