import { Button } from "@/components/ui/button"
import { useCarousel } from "@/components/ui/carousel/components/carousel-shared"
import { cn } from "@/lib/utils"
import { ChevronRight } from "lucide-react"
import * as React from "react"

/** Renders the carousel next component. */
export const CarouselNext = React.forwardRef<HTMLButtonElement, React.ComponentProps<typeof Button>>(({ className, variant = "outline", size = "icon", ...props }, ref) => {
  const { orientation, scrollNext, canScrollNext } = useCarousel()

  return (
    <Button
      ref={ref}
      variant={variant}
      size={size}
      className={cn("absolute size-8 rounded-full shadow-sm z-10", orientation === "horizontal" ? "right-2 top-1/2 -translate-y-1/2" : "bottom-2 left-1/2 -translate-x-1/2 rotate-90", className)}
      disabled={!canScrollNext}
      onClick={scrollNext}
      {...props}
    >
      <ChevronRight className="size-4" />
      <span className="sr-only">Next slide</span>
    </Button>
  )
})

CarouselNext.displayName = "CarouselNext"
