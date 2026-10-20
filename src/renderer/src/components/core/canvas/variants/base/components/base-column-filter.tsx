import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Funnel } from "lucide-react"

/** Keeps each column's search in a compact funnel popover while preserving its active filter. */
export function BaseColumnFilter({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <div className="flex items-center gap-1">
      <span>{label}</span>
      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            data-base-action="filter"
            data-filtered={Boolean(value.trim())}
            aria-label={`筛选${label}`}
            data-title={`筛选${label}`}
            className={`size-6 data-[state=open]:bg-green-600 data-[state=open]:!text-white data-[state=open]:[&_svg]:!text-white ${value.trim() ? "bg-green-600 !text-white [&_svg]:!text-white" : "text-stone-400"}`}
          >
            <Funnel className="!size-3" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className="w-48 p-2.5"
        >
          <p className="mb-1.5 text-[11px] font-medium">搜索{label}</p>
          <Input
            aria-label={`搜索${label}`}
            placeholder="搜索…"
            value={value}
            className="h-7 rounded-lg border-stone-200 bg-stone-50 px-2 text-[11px] md:text-[11px] shadow-none focus-visible:border-green-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-100 focus-visible:ring-offset-0"
            onChange={(event) => onChange(event.target.value)}
          />
          {value && (
            <Button
              variant="ghost"
              size="sm"
              className="mt-2 h-6 px-2 text-[11px] hover:!text-white active:!text-white focus:!text-white hover:bg-green-600 active:bg-green-600 focus:bg-green-600"
              onClick={() => onChange("")}
            >
              清除筛选
            </Button>
          )}
        </PopoverContent>
      </Popover>
    </div>
  )
}
