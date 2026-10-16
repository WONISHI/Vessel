import { buttonGroupVariants } from "@/components/ui/button-group/components/button-group-shared"
import { cn } from "@/lib/utils"
import { type VariantProps } from "class-variance-authority"

/** Renders the button group component. */
export function ButtonGroup({ className, orientation, ...props }: React.ComponentProps<"div"> & VariantProps<typeof buttonGroupVariants>) {
  return (
    <div
      role="group"
      data-slot="button-group"
      data-orientation={orientation}
      className={cn(buttonGroupVariants({ orientation }), className)}
      {...props}
    />
  )
}
