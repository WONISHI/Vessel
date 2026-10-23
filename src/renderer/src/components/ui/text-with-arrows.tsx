import { ArrowRight } from "lucide-react"
import { Fragment } from "react"

/** Preserve Git output lines so each arrow stays beside its own branch names. */
export function TextWithArrows({ text }: { text: string }) {
  return (
    <span className="inline-flex max-w-full flex-col items-start align-middle">
      {text.split(/\r?\n/).map((line, lineIndex) => (
        <span key={lineIndex} className="block min-h-[1lh] max-w-full whitespace-pre-wrap break-words">
          {line.split("->").map((part, index) => (
            <Fragment key={index}>
              {index > 0 && <ArrowRight aria-label="指向" className="mx-0.5 inline-block size-3 align-[-0.125em]" />}
              {part}
            </Fragment>
          ))}
        </span>
      ))}
    </span>
  )
}
