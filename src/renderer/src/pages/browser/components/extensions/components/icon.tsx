import type { BrowserExtension } from "@vessel/type"
import { Puzzle } from "lucide-react"

/** Renders the icon component. */
export const Icon = ({ item, className = "size-4 object-contain" }: { item: BrowserExtension; className?: string }) =>
  item.icon ? (
    <img
      src={item.icon}
      alt=""
      className={className}
    />
  ) : (
    <Puzzle className="size-4" />
  )
