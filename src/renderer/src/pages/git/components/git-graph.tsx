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

const LANE_COLORS = [
  "#2563eb", // blue
  "#16a34a", // green
  "#ea580c", // orange
  "#9333ea", // purple
  "#0891b2", // cyan
  "#e11d48", // rose
  "#d97706" // amber
]

const ROW_HEIGHT = 32
const COL_WIDTH = 18

/** 计算 Git 提交拓扑图的列位置与连线 */
export function computeGitTopology(commits: GitCommitItem[]): { nodes: GraphNode[]; maxColumns: number } {
  const nodes: GraphNode[] = []
  let activeLanes: (string | null)[] = [] // 存每列当前等待连接的 commit hash

  let maxCols = 1

  for (let r = 0; r < commits.length; r++) {
    const commit = commits[r]
    let col = activeLanes.indexOf(commit.hash)

    // 如果当前 commit 不在任何现有轨道中，分配第一个空闲轨道
    if (col === -1) {
      col = activeLanes.indexOf(null)
      if (col === -1) {
        col = activeLanes.length
        activeLanes.push(commit.hash)
      } else {
        activeLanes[col] = commit.hash
      }
    }

    maxCols = Math.max(maxCols, activeLanes.length)
    const nodeColor = LANE_COLORS[col % LANE_COLORS.length]

    const nextLanes = [...activeLanes]
    nextLanes[col] = null // 当前 commit 已处理完，移除

    const lines: GraphNode["lines"] = []

    // 1. 直线传递其他未完成的分支轨道
    for (let c = 0; c < activeLanes.length; c++) {
      if (c !== col && activeLanes[c] !== null) {
        lines.push({
          fromCol: c,
          toCol: c,
          type: "straight",
          color: LANE_COLORS[c % LANE_COLORS.length]
        })
      }
    }

    // 2. 将 parents 接入轨道
    const parents = commit.parents
    if (parents.length > 0) {
      // 主 parent 占据当前列
      const primaryParent = parents[0]
      const existingCol = nextLanes.indexOf(primaryParent)
      if (existingCol !== -1) {
        lines.push({
          fromCol: col,
          toCol: existingCol,
          type: "merge",
          color: nodeColor
        })
      } else {
        nextLanes[col] = primaryParent
        lines.push({
          fromCol: col,
          toCol: col,
          type: "straight",
          color: nodeColor
        })
      }

      // 处理多 parent 合并分支 (merge commits)
      for (let p = 1; p < parents.length; p++) {
        const mergeParent = parents[p]
        let pCol = nextLanes.indexOf(mergeParent)
        if (pCol === -1) {
          pCol = nextLanes.indexOf(null)
          if (pCol === -1) {
            pCol = nextLanes.length
            nextLanes.push(mergeParent)
          } else {
            nextLanes[pCol] = mergeParent
          }
        }
        lines.push({
          fromCol: col,
          toCol: pCol,
          type: "branch",
          color: LANE_COLORS[pCol % LANE_COLORS.length]
        })
      }
    }

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

/** Renders the git graph svg component. */
export function GitGraphSvg({ nodes, maxColumns, selectedIndex, onSelectIndex }: { nodes: GraphNode[]; maxColumns: number; selectedIndex: number; onSelectIndex: (index: number) => void }) {
  const width = Math.max(maxColumns * COL_WIDTH + 24, 60)
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

      {/* 提交节点圆圈 */}
      {nodes.map((node, row) => {
        const cx = node.column * COL_WIDTH + COL_WIDTH / 2 + 10
        const cy = row * ROW_HEIGHT + ROW_HEIGHT / 2
        const isSelected = row === selectedIndex

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
              r={isSelected ? 4.5 : 3.5}
              fill={node.color}
              className="git-commit-node"
              stroke="#ffffff"
              strokeWidth={1.8}
            />
          </g>
        )
      })}
    </svg>
  )
}
