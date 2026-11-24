import { List, ListTree } from "lucide-react"
import { Button } from "@/components/ui/button"

export function GitChangesViewToggle({ tree, onToggle, label }: { tree: boolean; onToggle: () => void; label: string }) {
  const title = `${label}切换为${tree ? "列表" : "树形"}视图`
  const Icon = tree ? List : ListTree
  return <Button type="button" variant="ghost" size="icon" className="git-changes-action size-7 rounded-md" aria-label={title} data-title={title} data-title-side="bottom" aria-pressed={tree} onClick={onToggle}><Icon className="size-4" strokeWidth={1.75} /></Button>
}
