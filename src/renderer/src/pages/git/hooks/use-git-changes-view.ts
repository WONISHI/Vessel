import { useState } from "react"

export function useGitChangesView(section: "staged" | "unstaged") {
  const key = `git-${section}-tree-view`
  const [tree, setTree] = useState(() => localStorage.getItem(key) === "true")
  return { tree, toggleTree: () => { setTree(!tree); localStorage.setItem(key, String(!tree)) } }
}
