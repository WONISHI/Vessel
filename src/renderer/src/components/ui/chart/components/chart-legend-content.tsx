import { getPayloadConfigFromPayload, useChart } from "@/components/ui/chart/components/chart-shared"
import { cn } from "@/lib/utils"
import * as React from "react"
import * as RechartsPrimitive from "recharts"

/** Renders the chart legend content component. */
export const ChartLegendContent = React.forwardRef<
  HTMLDivElement,
  React.ComponentProps<"div"> &
    React.ComponentProps<typeof RechartsPrimitive.DefaultLegendContent> & {
      hideIcon?: boolean
      nameKey?: string
    }
>(({ className, hideIcon = false, payload, verticalAlign = "bottom", nameKey }, ref) => {
  const { config } = useChart()

  if (!payload?.length) {
    return null
  }

  return (
    <div
      ref={ref}
      className={cn("flex items-center justify-center gap-4 text-xs", verticalAlign === "top" ? "pb-3" : "pt-3", className)}
    >
      {payload.map((item) => {
        const key = `${nameKey || item.dataKey || "value"}`
        const itemConfig = getPayloadConfigFromPayload(config, item, key)

        return (
          <div
            key={item.value}
            className={cn("flex items-center gap-1.5 [&>svg]:size-3 [&>svg]:text-muted-foreground")}
          >
            {itemConfig?.icon && !hideIcon ? (
              <itemConfig.icon />
            ) : (
              <div
                className="size-2 shrink-0 rounded-[2px]"
                style={{
                  backgroundColor: item.color
                }}
              />
            )}
            {itemConfig?.label}
          </div>
        )
      })}
    </div>
  )
})

ChartLegendContent.displayName = "ChartLegend"
