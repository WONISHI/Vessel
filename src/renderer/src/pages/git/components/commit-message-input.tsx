import { useEffect, useState, type MutableRefObject } from "react"

/** Keeps typing local so repository lists and diffs do not rerender per keystroke. */
export function CommitMessageInput({ draft, resetVersion, onSubmit }: { draft: MutableRefObject<string>; resetVersion: number; onSubmit: () => void }) {
  const [value, setValue] = useState(() => draft.current)
  useEffect(() => setValue(draft.current), [draft, resetVersion])
  return (
    <textarea
      rows={3}
      aria-label="提交信息"
      value={value}
      onChange={(event) => {
        draft.current = event.target.value
        setValue(event.target.value)
      }}
      placeholder="输入提交信息 (Commit message)…"
      className="vessel-field w-full resize-none rounded border border-stone-200 p-2 text-xs outline-none focus:border-green-600"
      onKeyDown={(event) => {
        if ((event.metaKey || event.ctrlKey) && event.key === "Enter" && !event.nativeEvent.isComposing && event.keyCode !== 229) {
          event.preventDefault()
          onSubmit()
        }
      }}
    />
  )
}
