import type { BrowserExtension } from "@vessel/type"
import { Puzzle } from "lucide-react"

/** Renders the icon component. */
export const Icon = ({ item }: { item: BrowserExtension }) =>
  item.icon ? (
    <img
      src={item.icon}
      alt=""
      className="size-4 object-contain"
    />
  ) : (
    <Puzzle className="size-4" />
  )
