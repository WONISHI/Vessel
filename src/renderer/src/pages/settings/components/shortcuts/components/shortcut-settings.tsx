import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Keys } from "@/pages/settings/components/shortcuts/components/keys"
import { categories, category } from "@/pages/settings/components/shortcuts/components/shortcuts-shared"
import { screenshotShortcut, shortcutLabel, shortcuts, type ShortcutId } from "@vessel/utils"
import { ChevronDown } from "lucide-react"

/** Renders the shortcut settings component. */
export function ShortcutSettings() {
  const mac = navigator.platform.includes("Mac")
  const rows: { id: string; group: string; title: string; scope: string; keys: string }[] = (Object.keys(shortcuts) as ShortcutId[]).map((id) => ({ id, group: category(id), title: shortcuts[id].label, scope: shortcuts[id].scope, keys: shortcutLabel(id, mac) }))
  rows.unshift({ id: "screenshot", group: "截图", title: screenshotShortcut.label, scope: screenshotShortcut.scope, keys: mac ? screenshotShortcut.mac : screenshotShortcut.windows })
  return (
    <>
      <h2>快捷键</h2>
      <p className="settings-description">按使用场景分组，编辑操作在对应编辑器中生效。滚动快捷键优先作用于鼠标悬停的内容区域。</p>
      <div className="settings-shortcuts space-y-3">
        {categories.map((group) => {
          const entries = rows.filter((row) => row.group === group)
          return (
            <Collapsible
              key={group}
              defaultOpen
              className="settings-shortcut-group overflow-hidden rounded-xl border bg-white"
            >
              <CollapsibleTrigger className="settings-shortcut-heading group flex w-full items-center gap-2 bg-stone-50/70 px-4 py-2.5 text-left text-xs font-semibold text-stone-700 hover:bg-stone-100">
                <ChevronDown className="size-3.5 transition-transform group-data-[state=closed]:-rotate-90" />
                {group}
                <span className="ml-auto text-[11px] font-normal text-stone-400">{entries.length}</span>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="settings-shortcut-rows divide-y divide-stone-100">
                  {entries.map((row) => (
                    <div
                      key={row.id}
                      className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-4 py-2.5"
                    >
                      <div className="min-w-0">
                        <div className="text-xs font-medium text-stone-800">{row.title}</div>
                        <p className="mt-1 text-[11px] text-stone-400">{row.scope}</p>
                      </div>
                      <Keys value={row.keys} />
                    </div>
                  ))}
                </div>
              </CollapsibleContent>
            </Collapsible>
          )
        })}
      </div>
    </>
  )
}
