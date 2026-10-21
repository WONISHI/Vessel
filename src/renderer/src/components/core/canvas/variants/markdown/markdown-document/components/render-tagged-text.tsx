import { parseKeyboardShortcutParts } from "@vessel/obsidian"
import { Badge } from "@/components/ui/badge"
import { Kbd, KbdGroup } from "@/components/ui/kbd"
import { Fragment, type ReactNode } from "react"

/** Renders tagged text and keyboard shortcuts. */
export function renderTaggedText(text: string): ReactNode {
  const parts = text.split(/((?<![\p{L}\p{N}_])#[\p{L}\p{N}_-]+)/u)
  return parts.map((part, index) => {
    if (/^#[\p{L}\p{N}_-]+$/u.test(part)) {
      return (
        <Badge
          key={index}
          asChild
          variant="secondary"
          className="mx-0.5 border-0 bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-green-700"
        >
          <span>{part}</span>
        </Badge>
      )
    }

    const shortcutParts = parseKeyboardShortcutParts(part)
    if (shortcutParts.length === 1 && shortcutParts[0].kind === "text") {
      return part
    }

    return (
      <Fragment key={index}>
        {shortcutParts.map((sub, subIndex) =>
          sub.kind === "shortcut" && sub.keys ? (
            <KbdGroup
              key={subIndex}
              aria-label={sub.text}
              className="mx-1 align-baseline inline-flex items-center gap-1 select-none"
            >
              {sub.keys.map((key, keyIndex) => (
                <Fragment key={keyIndex}>
                  {keyIndex > 0 && (
                    <span
                      aria-hidden="true"
                      className="text-[10px] text-stone-400 dark:text-stone-500 font-medium select-none mx-0.5"
                    >
                      {" + "}
                    </span>
                  )}
                  <Kbd className="select-none">{key}</Kbd>
                </Fragment>
              ))}
            </KbdGroup>
          ) : (
            sub.text
          )
        )}
      </Fragment>
    )
  })
}
