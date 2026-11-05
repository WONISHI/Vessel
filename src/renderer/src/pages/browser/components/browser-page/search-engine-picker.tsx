import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { getSearchEngine, searchEngines, setSearchEngine, subscribeSearchEngine, type SearchEngine } from "@/pages/browser/url"
import { Check } from "lucide-react"
import { useState, useSyncExternalStore } from "react"
import { toast } from "sonner"

function EngineLogo({ engine }: { engine: SearchEngine }) {
  return <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
    {engine === "bing" && <path fill="#008373" d="M4 2l5 2v12l4-2-2-4 8 3v4l-10 5-5-3z" />}
    {engine === "google" && <>
      <path fill="#4285f4" d="M22 12.2c0-.7-.1-1.4-.2-2H12v4h5.6c-.3 1.3-1 2.3-2.1 3l3.3 2.6c2-1.8 3.2-4.5 3.2-7.6z" />
      <path fill="#34a853" d="M12 22c2.8 0 5.2-.9 6.8-2.2l-3.3-2.6c-.9.6-2.1.9-3.5.9-2.7 0-5-1.8-5.9-4.2l-3.4 2.6A10 10 0 0 0 12 22z" />
      <path fill="#fbbc05" d="M6.1 13.9a6 6 0 0 1 0-3.8L2.7 7.5a10 10 0 0 0 0 9z" />
      <path fill="#ea4335" d="M12 5.9c1.5 0 2.9.5 4 1.6l3-3A10 10 0 0 0 2.7 7.5l3.4 2.6c.9-2.4 3.2-4.2 5.9-4.2z" />
    </>}
    {engine === "baidu" && <g fill="#2932e1">
      <ellipse cx="4" cy="9" rx="2.5" ry="3.4" transform="rotate(-20 4 9)" />
      <ellipse cx="9" cy="5" rx="2.5" ry="3.4" />
      <ellipse cx="15" cy="5" rx="2.5" ry="3.4" />
      <ellipse cx="20" cy="9" rx="2.5" ry="3.4" transform="rotate(20 20 9)" />
      <path d="M12 10c3 0 3.8 2.6 6.1 4.2 3.7 2.6 2.2 7.1-1.6 7.1-1.9 0-2.8-1.1-4.5-1.1s-2.6 1.1-4.5 1.1c-3.8 0-5.3-4.5-1.6-7.1C8.2 12.6 9 10 12 10z" />
    </g>}
    {engine === "duckduckgo" && <>
      <circle cx="12" cy="12" r="11" fill="#de5833" />
      <path fill="#fff" d="M8 21c.6-3.1 1.2-5.5.2-8.4C6.8 8.6 8.2 5 12 5c3 0 4.5 2.7 4.4 5.3l-2 4.5 1.8 6.3z" />
      <circle cx="13.8" cy="9" r="1" fill="#292524" />
      <path fill="#f4b53f" d="M14 11c2.6-1 5.8-1 6.3.3.5 1.6-2.6 2.6-5.6 2.1z" />
      <path fill="#65a30d" d="m9 17 3 1 3-1v4l-3-1-3 1z" />
    </>}
  </svg>
}

export function SearchEnginePicker({ open, onOpenChange, onSelect }: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSelect: () => void
}) {
  const engine = useSyncExternalStore(subscribeSearchEngine, getSearchEngine)
  const [saving, setSaving] = useState(false)

  const select = async (next: SearchEngine) => {
    onOpenChange(false)
    onSelect()
    if (next === engine) return
    setSaving(true)
    try {
      const settings = await window.electronAPI.getSettings()
      const saved = await window.electronAPI.saveSettings({ ...settings, searchEngine: next })
      setSearchEngine(saved.searchEngine || next)
      window.dispatchEvent(new Event("vessel:settings-saved"))
    } catch (error) {
      toast.error(`搜索引擎保存失败：${String(error)}`)
    } finally {
      setSaving(false)
    }
  }

  return <Popover open={open} onOpenChange={onOpenChange}>
    <PopoverTrigger asChild>
      <button type="button" data-search-engine-trigger aria-label={`切换搜索引擎，当前 ${searchEngines[engine].label}`} disabled={saving}
        onMouseDown={(event) => event.preventDefault()} className="flex size-5 shrink-0 items-center justify-center rounded hover:bg-stone-200 dark:hover:bg-white/10">
        <EngineLogo engine={engine} />
      </button>
    </PopoverTrigger>
    <PopoverContent align="start" sideOffset={10} className="z-[260] w-44 p-1"
      onOpenAutoFocus={(event) => event.preventDefault()}
      onCloseAutoFocus={(event) => event.preventDefault()}>
      {(Object.keys(searchEngines) as SearchEngine[]).map((value) => (
        <button key={value} type="button" className="flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-xs hover:bg-[#f0efed] focus-visible:bg-[#f0efed] dark:hover:bg-stone-800 dark:focus-visible:bg-stone-800"
          aria-pressed={value === engine} onMouseDown={(event) => event.preventDefault()} onClick={() => void select(value)}>
          <EngineLogo engine={value} />
          <span className="flex-1">{searchEngines[value].label}</span>
          {value === engine && <Check size={14} className="text-green-600" />}
        </button>
      ))}
    </PopoverContent>
  </Popover>
}
