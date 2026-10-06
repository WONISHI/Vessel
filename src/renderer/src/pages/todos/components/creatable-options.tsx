import { useId, useState } from "react"
import { Plus } from "lucide-react"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { greenInput } from "./todo-table-model"

/** Shared keyboard-accessible suggestions for tags and people; options come from saved data. */
export function CreatableOptions({
  suggestions,
  excluded = [],
  open,
  inputLabel,
  listLabel,
  placeholder,
  emptyLabel,
  duplicateLabel,
  onSelect
}: {
  suggestions: string[]
  excluded?: string[]
  open: boolean
  inputLabel: string
  listLabel: string
  placeholder: string
  emptyLabel: string
  duplicateLabel?: string
  onSelect: (value: string) => void
}) {
  const [input, setInput] = useState("")
  const [highlight, setHighlight] = useState(0)
  const listId = useId()
  const query = input.trim()
  const normalize = (value: string) => value.toLocaleLowerCase()
  const known = [...new Set(suggestions)]
  const isExcluded = (value: string) => excluded.some((item) => normalize(item) === normalize(value))
  const matches = known.filter((value) => !isExcluded(value) && normalize(value).includes(normalize(query)))
  const canCreate = !!query && !isExcluded(query) && !known.some((value) => normalize(value) === normalize(query))
  const choices = [...matches.map((label) => ({ label, create: false })), ...(canCreate ? [{ label: query, create: true }] : [])]
  const selectedIndex = Math.min(highlight, Math.max(0, choices.length - 1))

  return (
    <>
      <Input
        role="combobox"
        aria-label={inputLabel}
        aria-expanded={open}
        aria-autocomplete="list"
        aria-controls={listId}
        aria-activedescendant={choices.length ? `${listId}-${selectedIndex}` : undefined}
        value={input}
        onChange={(event) => {
          setInput(event.target.value)
          setHighlight(0)
        }}
        onKeyDown={(event) => {
          if (event.nativeEvent.isComposing) return
          if (event.key === "ArrowDown") {
            event.preventDefault()
            setHighlight((selectedIndex + 1) % Math.max(1, choices.length))
          }
          if (event.key === "ArrowUp") {
            event.preventDefault()
            setHighlight((selectedIndex - 1 + choices.length) % Math.max(1, choices.length))
          }
          if (event.key === "Enter") {
            event.preventDefault()
            if (choices[selectedIndex]) onSelect(choices[selectedIndex].label)
          }
        }}
        placeholder={placeholder}
        className={cn(greenInput, "h-8 text-xs mb-2")}
        autoFocus
      />
      <div
        id={listId}
        role="listbox"
        aria-label={listLabel}
        className="max-h-48 overflow-y-auto"
      >
        {choices.map((choice, index) => (
          <button
            key={choice.label}
            type="button"
            role="option"
            id={`${listId}-${index}`}
            aria-selected={selectedIndex === index}
            onMouseEnter={() => setHighlight(index)}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => onSelect(choice.label)}
            className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs text-stone-600 aria-selected:bg-green-50 aria-selected:text-green-700"
          >
            <Plus className="size-3" />
            {choice.create ? `创建「${choice.label}」` : choice.label}
          </button>
        ))}
        {!choices.length && <p className="p-2 text-xs text-stone-400">{query && duplicateLabel ? duplicateLabel : emptyLabel}</p>}
      </div>
    </>
  )
}
