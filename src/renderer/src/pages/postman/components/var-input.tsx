import { cn } from "@/lib/utils"
import { VARIABLE_PATTERN } from "@/pages/postman/lib/model"
import { useRef, type InputHTMLAttributes, type ReactNode } from "react"

/** Splits text into plain and `{{var}}` segments for highlighting. */
function segments(text: string, vars: Record<string, string>): ReactNode[] {
  const out: ReactNode[] = []
  let last = 0
  for (const match of text.matchAll(VARIABLE_PATTERN)) {
    const index = match.index ?? 0
    if (index > last) out.push(text.slice(last, index))
    out.push(
      <span key={index} className={cn("rounded-sm", match[1] in vars ? "api-var-known" : "api-var-unknown")}>
        {match[0]}
      </span>
    )
    last = index + match[0].length
  }
  if (last < text.length) out.push(text.slice(last))
  return out
}

/**
 * Text input that highlights `{{variable}}` placeholders (amber = defined, red = undefined) via a
 * mirrored overlay, and lists the resolved values in its tooltip.
 */
export function VarInput({ value, onValueChange, vars, className, wrapperClassName, ...props }: Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange"> & { value: string; onValueChange: (value: string) => void; vars: Record<string, string>; wrapperClassName?: string }) {
  const overlay = useRef<HTMLDivElement>(null)
  const names = [...new Set([...value.matchAll(VARIABLE_PATTERN)].map((match) => match[1]))]
  const title = names.length ? names.map((name) => `{{${name}}} = ${vars[name] ?? "（未定义）"}`).join("\n") : undefined
  const sync = (input: HTMLInputElement) => {
    if (overlay.current) overlay.current.scrollLeft = input.scrollLeft
  }
  return (
    <div className={cn("api-var-field relative min-w-0", wrapperClassName)}>
      <div ref={overlay} aria-hidden className={cn(className, "api-var-overlay pointer-events-none absolute inset-0 flex items-center overflow-hidden whitespace-pre border-transparent bg-transparent")}>
        {segments(value, vars)}
        {"\u200b"}
      </div>
      <input
        {...props}
        value={value}
        spellCheck={false}
        data-title={title}
        data-title-side="bottom"
        onChange={(event) => {
          onValueChange(event.target.value)
          sync(event.target)
        }}
        onScroll={(event) => sync(event.currentTarget)}
        onKeyUp={(event) => sync(event.currentTarget)}
        onSelect={(event) => sync(event.currentTarget)}
        className={cn(className, "api-var-input relative w-full bg-transparent")}
      />
    </div>
  )
}
