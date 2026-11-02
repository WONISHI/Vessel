/** 按 / 分段把分支名建成树，供 Git 侧栏 BRANCHES / REMOTES 使用 */

export type BranchTreeNode = {
  /** 展开状态用的路径键，如 feature、feature/0.0.1 */
  key: string
  /** 当前段显示名 */
  label: string
  /** 叶子可切换分支的完整名；目录节点为 null */
  fullName: string | null
  children: BranchTreeNode[]
}

type MutableNode = {
  key: string
  label: string
  fullName: string | null
  childrenMap: Map<string, MutableNode>
}

/** 把扁平分支名列表建成按斜杠分组的树 */
export function buildBranchTree(names: string[]): BranchTreeNode[] {
  const root = new Map<string, MutableNode>()

  for (const name of names) {
    const parts = name.split("/").filter(Boolean)
    if (parts.length === 0) continue
    let map = root
    let prefix = ""
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]!
      prefix = prefix ? `${prefix}/${part}` : part
      const isLast = i === parts.length - 1
      let node = map.get(part)
      if (!node) {
        node = { key: prefix, label: part, fullName: isLast ? name : null, childrenMap: new Map() }
        map.set(part, node)
      } else if (isLast) {
        node.fullName = name
      }
      map = node.childrenMap
    }
  }

  const toList = (map: Map<string, MutableNode>): BranchTreeNode[] =>
    [...map.values()]
      .sort((a, b) => {
        // 每层：有子节点的目录在上，叶子分支在下；同组内按名称排序
        const aFolder = a.childrenMap.size > 0
        const bFolder = b.childrenMap.size > 0
        if (aFolder !== bFolder) return aFolder ? -1 : 1
        return a.label.localeCompare(b.label, undefined, { sensitivity: "base" })
      })
      .map((node) => ({
        key: node.key,
        label: node.label,
        fullName: node.fullName,
        children: toList(node.childrenMap)
      }))

  return toList(root)
}

/** 当前分支路径上需要默认展开的目录键（不含叶子本身） */
export function ancestorKeysForBranch(branch: string): string[] {
  const parts = branch.split("/").filter(Boolean)
  if (parts.length <= 1) return []
  const keys: string[] = []
  let prefix = ""
  for (let i = 0; i < parts.length - 1; i++) {
    prefix = prefix ? `${prefix}/${parts[i]}` : parts[i]!
    keys.push(prefix)
  }
  return keys
}

/**
 * 远程列表中与当前本地分支对应的引用路径需要展开的目录键
 * （如 current=refactor/0.0.1 且存在 origin/refactor/0.0.1 → 展开 origin、origin/refactor）
 */
export function ancestorKeysForCurrentInRemotes(remotes: string[], current: string): string[] {
  if (!current) return []
  const keys = new Set<string>()
  for (const remote of remotes) {
    if (remote === current || remote.endsWith(`/${current}`)) {
      for (const key of ancestorKeysForBranch(remote)) keys.add(key)
    }
  }
  return [...keys]
}
