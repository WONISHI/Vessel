import { ApiCheckbox } from "@/pages/postman/components/api-controls"
import { VarInput } from "@/pages/postman/components/var-input"
import type { KV } from "@/pages/postman/lib/model"
import { Trash2 } from "lucide-react"
import { useState } from "react"

const toBulk = (rows: KV[]) => rows.filter((row) => row.key || row.value).map((row) => `${row.enabled ? "" : "//"}${row.key}:${row.value}`).join("\n")
const fromBulk = (text: string): KV[] =>
  text
    .split("\n")
    .filter((line) => line.trim())
    .map((line) => {
      const disabled = line.trimStart().startsWith("//")
      const body = disabled ? line.trimStart().slice(2) : line
      const index = body.indexOf(":")
      return { key: (index === -1 ? body : body.slice(0, index)).trim(), value: index === -1 ? "" : body.slice(index + 1).trim(), enabled: !disabled }
    })

/**
 * Postman-style key/value editor: a trailing placeholder row turns into a real row when typed into,
 * `{{vars}}` are highlighted, and a bulk mode edits `key:value` lines (`//` prefix = disabled).
 */
export function KVTable({ rows, onChange, vars, keyPlaceholder = "Key", valuePlaceholder = "Value", title }: { rows: KV[]; onChange: (rows: KV[]) => void; vars: Record<string, string>; keyPlaceholder?: string; valuePlaceholder?: string; title?: string }) {
  const [bulk, setBulk] = useState<string | null>(null)
  const display = [...rows, { key: "", value: "", enabled: true }]
  const update = (index: number, patch: Partial<KV>) => {
    const next = display.map((row, i) => (i === index ? { ...row, ...patch } : row))
    onChange(next.filter((row, i) => i < rows.length || row.key || row.value))
  }
  const allEnabled = rows.length > 0 && rows.every((row) => row.enabled)
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-[11px] font-semibold text-stone-400">
        <span>{title}</span>
        <button type="button" className="rounded px-1.5 py-0.5 font-medium text-amber-600 hover:bg-amber-50" onClick={() => {
          if (bulk === null) setBulk(toBulk(rows))
          else {
            onChange(fromBulk(bulk))
            setBulk(null)
          }
        }}>
          {bulk === null ? "批量编辑" : "表格编辑"}
        </button>
      </div>
      {bulk !== null ? (
        <textarea aria-label="批量编辑" value={bulk} onChange={(event) => setBulk(event.target.value)} spellCheck={false} placeholder={"key:value\n// 以 // 开头表示禁用"} className="h-40 w-full resize-y rounded border border-stone-200 p-2 font-mono text-xs outline-none focus:border-amber-500" />
      ) : (
        <div className="overflow-hidden rounded border border-stone-200">
          <div className="grid grid-cols-[28px_minmax(0,1fr)_minmax(0,1.4fr)_28px] border-b border-stone-200 bg-stone-50 text-[11px] font-semibold text-stone-500">
            <span className="grid place-items-center" data-title="全选 / 全不选">
              <ApiCheckbox aria-label="全部启用" checked={allEnabled} disabled={!rows.length} onCheckedChange={(checked) => onChange(rows.map((row) => ({ ...row, enabled: checked === true })))} />
            </span>
            <span className="border-l border-stone-200 px-2 py-1">{keyPlaceholder}</span>
            <span className="border-l border-stone-200 px-2 py-1">{valuePlaceholder}</span>
            <span />
          </div>
          {display.map((row, index) => {
            const placeholder = index === rows.length
            return (
              <div key={index} className={`group grid grid-cols-[28px_minmax(0,1fr)_minmax(0,1.4fr)_28px] border-b border-stone-100 last:border-b-0 ${row.enabled || placeholder ? "" : "opacity-55"}`}>
                <span className="grid place-items-center">
                  {!placeholder && <ApiCheckbox aria-label="启用" checked={row.enabled} onCheckedChange={(checked) => update(index, { enabled: checked === true })} />}
                </span>
                <VarInput aria-label={keyPlaceholder} value={row.key} vars={vars} placeholder={keyPlaceholder} onValueChange={(key) => update(index, { key })} wrapperClassName="border-l border-stone-200 focus-within:ring-1 focus-within:ring-inset focus-within:ring-amber-400" className="h-7 px-2 font-mono text-xs outline-none" />
                <VarInput aria-label={valuePlaceholder} value={row.value} vars={vars} placeholder={valuePlaceholder} onValueChange={(value) => update(index, { value })} wrapperClassName="border-l border-stone-200 focus-within:ring-1 focus-within:ring-inset focus-within:ring-amber-400" className="h-7 px-2 font-mono text-xs outline-none" />
                <span className="grid place-items-center">
                  {!placeholder && (
                    <button type="button" aria-label="删除" className="rounded p-1 text-stone-400 opacity-0 hover:text-red-600 group-hover:opacity-100" onClick={() => onChange(rows.filter((_, i) => i !== index))}>
                      <Trash2 className="size-3.5" />
                    </button>
                  )}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
