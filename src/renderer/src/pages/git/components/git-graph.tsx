import type { GitCommitItem } from "@vessel/type"

export interface GraphNode {
  commit: GitCommitItem
  column: number
  color: string
  lines: Array<{
    fromCol: number
    toCol: number
    type: "straight" | "merge" | "branch"
    color: string
  }>
}

const BRANCH_COLORS = [
  "#2563eb", // blue
  "#dc2626", // red
  "#f59e0b", // orange
  "#eab308", // yellow
  "#16a34a", // green
  "#9333ea", // purple
  "#0891b2", // cyan
  "#e11d48" // rose
]

const ROW_HEIGHT = 32
const COL_WIDTH = 18

/** 计算 Git 提交拓扑图的列位置与连线 */
export function computeGitTopology(commits: GitCommitItem[]): { nodes: GraphNode[]; maxColumns: number } {
  const nodes: GraphNode[] = []
  const byHash = new Map(commits.map((commit) => [commit.hash, commit]))
  const mainPath = new Set<string>()
  let mainHash: string | undefined = commits[0]?.hash
  while (mainHash && !mainPath.has(mainHash)) {
    mainPath.add(mainHash)
    mainHash = byHash.get(mainHash)?.parents[0]
  }
  // Plan colors from the visible topology before drawing. Simple side paths can
  // reuse red after joining the main path; nested histories reserve deeper colors.
  // This avoids changing colors just because a newer, unrelated merge is added.
  const nesting = new Map<string, number>()
  const joins = new Map<string, string | undefined>()
  const preferredColors = new Map<string, number>()
  for (let index = commits.length - 1; index >= 0; index--) {
    const commit = commits[index]
    if (mainPath.has(commit.hash)) {
      nesting.set(commit.hash, 0)
      joins.set(commit.hash, commit.hash)
      preferredColors.set(commit.hash, 0)
      continue
    }
    const depth = (nesting.get(commit.parents[0]) ?? 0) + Number(commit.parents.length > 1)
    const join = joins.get(commit.parents[0])
    nesting.set(commit.hash, depth)
    joins.set(commit.hash, join)
    const reserved = new Set<number>()
    for (let level = 1; level <= Math.min(depth, BRANCH_COLORS.length - 2); level++) reserved.add(level)
    // Paths meeting at a merge share that boundary row. Keep its older side-path
    // colors reserved until the newer path is allocated, rather than freeing early.
    for (const parent of (join ? byHash.get(join)?.parents.slice(1) : undefined) ?? []) {
      const color = preferredColors.get(parent)
      if (color !== undefined) reserved.add(color)
    }
    const available = BRANCH_COLORS.findIndex((_, color) => color > 0 && !reserved.has(color))
    preferredColors.set(commit.hash, available > 0 ? available : 1)
  }
  // Only a nested shared tail that ends directly at another merge needs a
  // boundary override. Ordinary merge sections keep the existing color plan.
  const boundaryColors = new Map<string, number>()
  type Lane = { hash: string; tip: string; color: string }
  let activeLanes: (Lane | null)[] = []
  const createLane = (hash: string, lanes: (Lane | null)[], preferred = boundaryColors.get(hash) ?? (preferredColors.get(hash) || 1)): Lane => {
    const used = new Set(lanes.map((lane) => lane?.color))
    let color = BRANCH_COLORS[0]
    for (let attempt = 0; attempt < BRANCH_COLORS.length; attempt++) {
      const colorIndex = (preferred + attempt) % BRANCH_COLORS.length
      if (preferred > 0 && colorIndex === 0) continue
      color = BRANCH_COLORS[colorIndex]
      if (!used.has(color)) break
    }
    return { hash, tip: hash, color }
  }

  let maxCols = 1

  for (let r = 0; r < commits.length; r++) {
    const commit = commits[r]
    let col = activeLanes.findIndex((lane) => lane?.hash === commit.hash)

    // 如果当前 commit 不在任何现有轨道中，分配第一个空闲轨道
    if (col === -1) {
      col = activeLanes.indexOf(null)
      if (col === -1) {
        col = activeLanes.length
        activeLanes.push(createLane(commit.hash, activeLanes, r === 0 ? 0 : undefined))
      } else {
        activeLanes[col] = createLane(commit.hash, activeLanes)
      }
    }

    maxCols = Math.max(maxCols, activeLanes.length)
    const nodeColor = activeLanes[col]!.color

    const nextLanes = [...activeLanes]
    nextLanes[col] = null // 当前 commit 已处理完，移除

    const lines: GraphNode["lines"] = []

    const parents = commit.parents
    if (parents.length > 0) {
      // 主分支 parent 保持在当前列，各分支平行延伸不提前重叠
      const primaryParent = parents[0]
      nextLanes[col] = { ...activeLanes[col]!, hash: primaryParent }

      // 多 parent 合并提交，优先复用已在等待该 parent 的轨道
      for (let p = 1; p < parents.length; p++) {
        const branchParent = parents[p]
        let pCol = nextLanes.findIndex((lane) => lane?.hash === branchParent)
        if (pCol === -1) {
          pCol = nextLanes.indexOf(null)
          if (pCol === -1) {
            pCol = nextLanes.length
            nextLanes.push(createLane(branchParent, nextLanes))
          } else {
            nextLanes[pCol] = createLane(branchParent, nextLanes)
          }
        } else if (pCol !== col && nextLanes[pCol]!.tip !== branchParent) {
          // A nested merge reaches an existing path's shared tail. Its incoming
          // segment keeps its color; the shared tail starts a separate identity.
          const boundary = byHash.get(joins.get(branchParent) ?? "")
          const boundaryParent = boundary?.parents.length === 2 ? boundary.parents[1] : undefined
          const redAvailable = !nextLanes.some((lane) => lane?.color === BRANCH_COLORS[1])
          const isMainMergeTail = mainPath.has(commit.hash) && !mainPath.has(branchParent)
            && byHash.get(branchParent)?.parents.length === 1
          if (isMainMergeTail && boundaryParent && preferredColors.get(boundaryParent) === 1 && redAvailable) {
            // At a merge-to-merge boundary, use red for the shared tail and
            // orange for the following side path. Do not rotate other sections.
            nextLanes[pCol] = createLane(branchParent, nextLanes, 1)
            boundaryColors.set(boundaryParent, 2)
          } else {
            const previousColor = BRANCH_COLORS.indexOf(nextLanes[pCol]!.color)
            nextLanes[pCol] = createLane(branchParent, nextLanes, Math.min(previousColor + 1, BRANCH_COLORS.length - 1))
          }
        }
        lines.push({
          fromCol: col,
          toCol: pCol,
          type: "branch",
          color: nextLanes[pCol]!.color
        })
      }
    }

    // 检查下一个紧接着要渲染的提交
    const nextCommitHash = r + 1 < commits.length ? commits[r + 1].hash : null
    const primaryNextCol = nextCommitHash ? nextLanes.findIndex((lane) => lane?.hash === nextCommitHash) : -1

    // 处理当前提交的主轨道连线
    if (parents.length > 0) {
      const primaryParent = parents[0]
      if (nextCommitHash && primaryParent === nextCommitHash && col !== primaryNextCol && primaryNextCol !== -1) {
        // 当前列与更低列在下一个提交汇合
        lines.push({
          fromCol: col,
          toCol: primaryNextCol,
          type: "merge",
          color: nodeColor
        })
        nextLanes[col] = null
      } else {
        lines.push({
          fromCol: col,
          toCol: col,
          type: "straight",
          color: nodeColor
        })
      }
    }

    // 处理其他并行轨道的直行或向公共祖先汇合
    for (let c = 0; c < activeLanes.length; c++) {
      if (c === col || activeLanes[c] === null) continue

      if (activeLanes[c]?.hash === commit.hash) {
        // 该轨道已到达当前提交，汇入当前提交列并关闭
        lines.push({
          fromCol: c,
          toCol: col,
          type: "merge",
          color: activeLanes[c]!.color
        })
        nextLanes[c] = null
        continue
      }

      if (nextCommitHash && nextLanes[c]?.hash === nextCommitHash && c !== primaryNextCol && primaryNextCol !== -1) {
        // 该轨道在进入下一个提交节点时汇入主轨道
        lines.push({
          fromCol: c,
          toCol: primaryNextCol,
          type: "merge",
          color: activeLanes[c]!.color
        })
        nextLanes[c] = null
      } else {
        lines.push({
          fromCol: c,
          toCol: c,
          type: "straight",
          color: activeLanes[c]!.color
        })
      }
    }

    // 更新最大列数
    maxCols = Math.max(maxCols, activeLanes.length, nextLanes.length)

    // 清理尾部 null
    while (nextLanes.length > 0 && nextLanes[nextLanes.length - 1] === null) {
      nextLanes.pop()
    }

    activeLanes = nextLanes

    nodes.push({
      commit,
      column: col,
      color: nodeColor,
      lines
    })
  }

  return { nodes, maxColumns: maxCols }
}

/** 计算拓扑图所需的列宽 */
export function getGraphWidth(maxColumns: number): number {
  return Math.max(maxColumns * COL_WIDTH + 24, 60)
}

/** Renders the git graph svg component. */
export function GitGraphSvg({
  nodes,
  maxColumns,
  selectedIndex,
  onSelectIndex,
  currentBranch
}: {
  nodes: GraphNode[]
  maxColumns: number
  selectedIndex: number
  onSelectIndex: (index: number) => void
  currentBranch?: string
}) {
  const width = getGraphWidth(maxColumns)
  const height = nodes.length * ROW_HEIGHT

  return (
    <svg
      width={width}
      height={height}
      className="select-none overflow-visible"
    >
      {/* 连线绘制 */}
      {nodes.map((node, row) => {
        const y1 = row * ROW_HEIGHT + ROW_HEIGHT / 2
        const y2 = y1 + ROW_HEIGHT

        return node.lines.map((line, lIdx) => {
          const x1 = line.fromCol * COL_WIDTH + COL_WIDTH / 2 + 10
          const x2 = line.toCol * COL_WIDTH + COL_WIDTH / 2 + 10

          if (line.fromCol === line.toCol) {
            return (
              <line
                key={`line-${row}-${lIdx}`}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke={line.color}
                strokeWidth={2.2}
                strokeLinecap="round"
              />
            )
          }

          // 平滑三次贝塞尔曲线连接分叉与合并
          const path = `M ${x1} ${y1} C ${x1} ${y1 + ROW_HEIGHT / 2}, ${x2} ${y2 - ROW_HEIGHT / 2}, ${x2} ${y2}`
          return (
            <path
              key={`path-${row}-${lIdx}`}
              d={path}
              fill="none"
              stroke={line.color}
              strokeWidth={2.2}
              strokeLinecap="round"
            />
          )
        })
      })}

      {/* 提交节点圆圈 (参考 SourceTree: 仅当前检出的 HEAD 显示为空心圆圈，其余提交均为实心圆点) */}
      {nodes.map((node, row) => {
        const cx = node.column * COL_WIDTH + COL_WIDTH / 2 + 10
        const cy = row * ROW_HEIGHT + ROW_HEIGHT / 2
        const isSelected = row === selectedIndex
        const isHead = Boolean(
          node.commit.refs &&
          node.commit.refs.some(
            (r) =>
              r === "HEAD" ||
              r.startsWith("HEAD -> ") ||
              (currentBranch && (r === currentBranch || r === `HEAD -> ${currentBranch}`))
          )
        )

        return (
          <g
            key={`node-${row}`}
            className="cursor-pointer"
            onClick={() => onSelectIndex(row)}
          >
            {isSelected && (
              <circle
                cx={cx}
                cy={cy}
                r={7}
                fill="none"
                className="git-commit-node"
                stroke={node.color}
                strokeWidth={2}
                strokeOpacity={0.6}
              />
            )}
            <circle
              cx={cx}
              cy={cy}
              r={isSelected ? 4.5 : isHead ? 4 : 3}
              fill={isHead ? (isSelected ? "#eff6ff" : "#ffffff") : node.color}
              className="git-commit-node"
              stroke={isHead ? node.color : "#ffffff"}
              strokeWidth={isHead ? 2.2 : 1.5}
            />
          </g>
        )
      })}
    </svg>
  )
}
