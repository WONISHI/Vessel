import { Slider } from "@/components/ui/slider"
import { useId } from "react"

/** Renders the range field component. */
export function RangeField({ label, value, onChange, max = 100, disabled }: { label: string; value: number; onChange: (v: number) => void; max?: number; disabled?: boolean }) {
  const id = useId()
  return (
    <div className="image-field">
      <span id={id}>{label}</span>
      <div className="image-range">
        <Slider
          aria-labelledby={id}
          min={0}
          max={max}
          step={1}
          value={[value]}
          disabled={disabled}
          onValueChange={(values) => onChange(values[0])}
        />
        <output aria-labelledby={id}>{value}</output>
      </div>
    </div>
  )
}
