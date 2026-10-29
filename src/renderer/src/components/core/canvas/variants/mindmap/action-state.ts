type Node = { id: string; expanded?: boolean; children?: Node[]; parent?: Node }
export function mindmapActionState(root: Node, selected: Node | undefined, count: number, focused: boolean) {
  const state: Record<string, boolean> = { left: true, right: true, both: true, unfocus: focused }
  const branches = (node: Node): Node[] => node.children?.length ? [node, ...node.children.flatMap(branches)] : []
  const all = branches(root)
  state["expand-all"] = all.some((node) => node.expanded === false)
  state["collapse-all"] = all.some((node) => node.expanded !== false)
  if (!selected || count !== 1) return state
  for (const action of ["child", "edit", "bold"]) state[action] = true
  const isRoot = selected.id === root.id
  for (const action of ["sibling", "before", "parent", "copy", "delete", "focus"]) state[action] = !isRoot && !!selected.parent
  const siblings = selected.parent?.children || []
  const index = siblings.findIndex((node) => node.id === selected.id)
  state.up = !isRoot && index > 0
  state.down = !isRoot && index >= 0 && index < siblings.length - 1
  const descendants = branches(selected)
  state.expand = isRoot ? descendants.some((node) => node.expanded === false) : !!selected.children?.length && selected.expanded === false
  state.collapse = descendants.length > 0 && (isRoot ? descendants.some((node) => node.expanded !== false) : selected.expanded !== false)
  state["delete-children"] = !!selected.children?.length
  return state
}
