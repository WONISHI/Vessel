import { Kbd, KbdGroup } from "@/components/ui/kbd"
import { Fragment } from "react"

/** Renders the keys component. */
export function Keys({ value }: { value: string }) {
  return (
    <KbdGroup aria-label={value}>
      {value.split(/\s*\+\s*/).map((key, index) => (
        <Fragment key={`${index}:${key}`}>
          {index > 0 && (
            <span
              aria-hidden
              className="text-[10px] text-stone-400"
            >
              +
            </span>
          )}
          <Kbd>{key}</Kbd>
        </Fragment>
      ))}
    </KbdGroup>
  )
}
