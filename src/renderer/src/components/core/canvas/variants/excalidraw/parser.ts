import LZString from "lz-string"

export interface ParsedExcalidrawScene {
  elements: any[]
  appState: Record<string, any>
  files: Record<string, any>
  isMarkdown: boolean
  frontmatter?: string
  notes?: string
}

/** 判断给定文件路径或内容是否属于 Excalidraw / 白板文件 */
export function isExcalidrawFile(path: string, content?: string): boolean {
  if (/\.(excalidraw\.md|excalidraw|canvas)$/i.test(path)) return true
  if (content) {
    if (content.includes("excalidraw-plugin:") || content.includes("# Excalidraw Data")) return true
    if (content.includes("```compressed-json")) return true
    if (content.includes('"type": "excalidraw"') || content.includes('"type":"excalidraw"')) return true
  }
  return false
}

/** Performs the chunk string operation. */
function chunkString(str: string, size = 200): string {
  const numChunks = Math.ceil(str.length / size)
  const chunks = new Array(numChunks)
  for (let i = 0, o = 0; i < numChunks; ++i, o += size) {
    chunks[i] = str.substring(o, o + size)
  }
  return chunks.join("\n\n")
}

/** 创建初始 Obsidian Excalidraw Markdown 文件模板 */
export function createNewExcalidrawContent(_title?: string): string {
  const initialData = {
    type: "excalidraw",
    version: 2,
    source: "https://excalidraw.com",
    elements: [],
    appState: {
      gridSize: null,
      viewBackgroundColor: "#ffffff"
    },
    files: {}
  }
  const compressed = LZString.compressToBase64(JSON.stringify(initialData))
  return [
    "---",
    "",
    "excalidraw-plugin: parsed",
    "tags: [excalidraw]",
    "",
    "---",
    "==⚠  Switch to EXCALIDRAW VIEW in the MORE OPTIONS menu of this document. ⚠==",
    "",
    "# Text Elements",
    "%%",
    "%%",
    "",
    "# Excalidraw Data",
    "## Drawing",
    "```compressed-json",
    chunkString(compressed),
    "```",
    "%%"
  ].join("\n")
}

/** 解析 Excalidraw / Obsidian Excalidraw Markdown / Canvas 内容 */
export function parseExcalidrawDocument(content: string): ParsedExcalidrawScene {
  const defaultScene: ParsedExcalidrawScene = {
    elements: [],
    appState: {
      viewBackgroundColor: "#ffffff",
      gridSize: null
    },
    files: {},
    isMarkdown: true
  }

  if (!content || !content.trim()) return defaultScene

  const trimmed = content.trim()

  // 1. 尝试直接按 JSON 解析（.excalidraw 或 .canvas）
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    try {
      const parsed = JSON.parse(trimmed)
      if (parsed.elements && Array.isArray(parsed.elements)) {
        return {
          elements: parsed.elements,
          appState: parsed.appState || { viewBackgroundColor: "#ffffff" },
          files: parsed.files || {},
          isMarkdown: false
        }
      }
      // 兼容 Obsidian Canvas JSON: { nodes: [...], edges: [...] }
      if (Array.isArray(parsed.nodes)) {
        const elements = convertCanvasNodesToExcalidraw(parsed.nodes, parsed.edges || [])
        return {
          elements,
          appState: { viewBackgroundColor: "#ffffff" },
          files: {},
          isMarkdown: false
        }
      }
    } catch {
      // 不是纯 JSON，继续后续解析
    }
  }

  // 2. 解析 Obsidian Excalidraw Markdown 格式
  // 提取 compressed-json 代码块
  const compressedMatch = content.match(/```compressed-json\s*([\s\S]*?)```/)
  if (compressedMatch && compressedMatch[1]) {
    const rawCompressed = compressedMatch[1].replace(/\s+/g, "")
    try {
      let decompressed = LZString.decompressFromBase64(rawCompressed)
      if (!decompressed) decompressed = LZString.decompressFromUTF16(rawCompressed)
      if (!decompressed) decompressed = LZString.decompress(rawCompressed)
      if (decompressed) {
        const parsed = JSON.parse(decompressed)
        return {
          elements: Array.isArray(parsed.elements) ? parsed.elements : [],
          appState: parsed.appState || { viewBackgroundColor: "#ffffff" },
          files: parsed.files || {},
          isMarkdown: true
        }
      }
    } catch (e) {
      console.warn("Failed to decompress compressed-json:", e)
    }
  }

  // 3. 提取常规 ```json 代码块（查找包含 elements 或 type: excalidraw 的代码块）
  const jsonBlocks = [...content.matchAll(/```json\s*([\s\S]*?)```/g)]
  for (const match of jsonBlocks) {
    const blockContent = match[1]?.trim()
    if (!blockContent) continue
    try {
      const parsed = JSON.parse(blockContent)
      if (parsed.elements && Array.isArray(parsed.elements)) {
        return {
          elements: parsed.elements,
          appState: parsed.appState || { viewBackgroundColor: "#ffffff" },
          files: parsed.files || {},
          isMarkdown: true
        }
      }
    } catch {
      // 忽略非 Excalidraw 的 json 代码块
    }
  }

  // 4. 容错搜索包含 "type": "excalidraw" 的任意 JSON 对象
  const fallbackMatch = content.match(/\{[\s\S]*"type"\s*:\s*"excalidraw"[\s\S]*"elements"\s*:\s*\[[\s\S]*\][\s\S]*\}/)
  if (fallbackMatch) {
    try {
      const parsed = JSON.parse(fallbackMatch[0])
      return {
        elements: Array.isArray(parsed.elements) ? parsed.elements : [],
        appState: parsed.appState || { viewBackgroundColor: "#ffffff" },
        files: parsed.files || {},
        isMarkdown: true
      }
    } catch {
      // 忽略
    }
  }

  return defaultScene
}

/** 序列化 Excalidraw 画布为目标文件格式 */
export function serializeExcalidrawDocument(scene: { elements: any[]; appState?: Record<string, any>; files?: Record<string, any> }, originalContent?: string): string {
  const elements = (scene.elements || []).filter((el) => !el.isDeleted)
  const appState = scene.appState || {}
  const files = scene.files || {}

  const cleanAppState = {
    gridSize: appState.gridSize ?? null,
    viewBackgroundColor: appState.viewBackgroundColor ?? "#ffffff"
  }

  const drawingPayload = {
    type: "excalidraw",
    version: 2,
    source: "https://excalidraw.com",
    elements,
    appState: cleanAppState,
    files
  }

  // 如果原本是非 Markdown 的纯 JSON 文件，直接返回 JSON
  const isPureJson = originalContent && originalContent.trim().startsWith("{") && !originalContent.includes("---")
  if (isPureJson) {
    return JSON.stringify(drawingPayload, null, 2)
  }

  // 提取文本元素生成 Text Elements 供 Obsidian/Vessel 搜索
  const textLines: string[] = []
  elements.forEach((el) => {
    if (el.type === "text" && typeof el.text === "string" && el.text.trim()) {
      const sanitized = el.text.replace(/\r?\n/g, " ").trim()
      textLines.push(`${sanitized} ^${el.id}`)
    }
  })

  const textElementsSection = textLines.length ? textLines.join("\n\n") + "\n\n" : ""
  const jsonString = JSON.stringify(drawingPayload)
  const compressed = LZString.compressToBase64(jsonString)
  const chunked = chunkString(compressed)

  // 生成标准的 Obsidian Excalidraw Markdown 结构
  return ["---", "", "excalidraw-plugin: parsed", "tags: [excalidraw]", "", "---", "==⚠  Switch to EXCALIDRAW VIEW in the MORE OPTIONS menu of this document. ⚠==", "", "# Excalidraw Data", "## Text Elements", textElementsSection + "%%", "## Drawing", "```compressed-json", chunked, "```", "%%"].join(
    "\n"
  )
}

/** 辅助转换 Obsidian .canvas 节点与边为 Excalidraw 元素 */
function convertCanvasNodesToExcalidraw(nodes: any[], edges: any[]): any[] {
  const elements: any[] = []
  const nodeMap = new Map<string, any>()

  nodes.forEach((node, index) => {
    const id = node.id || `node_${index}`
    const x = node.x ?? 0
    const y = node.y ?? 0
    const width = node.width ?? 200
    const height = node.height ?? 100
    nodeMap.set(id, { x, y, width, height })

    // 矩形背景
    elements.push({
      id: `rect_${id}`,
      type: "rectangle",
      x,
      y,
      width,
      height,
      strokeColor: "#1e1e1e",
      backgroundColor: node.color ? node.color : "#f8f9fa",
      fillStyle: "solid",
      strokeWidth: 2,
      roughness: 1,
      opacity: 100,
      roundness: { type: 3 },
      isDeleted: false
    })

    // 文本内容
    if (node.text) {
      elements.push({
        id: `text_${id}`,
        type: "text",
        x: x + 10,
        y: y + 10,
        width: Math.max(width - 20, 20),
        height: Math.max(height - 20, 20),
        text: String(node.text),
        fontSize: 16,
        fontFamily: 1,
        textAlign: "left",
        verticalAlign: "top",
        strokeColor: "#1e1e1e",
        isDeleted: false
      })
    }
  })

  edges.forEach((edge, index) => {
    const from = nodeMap.get(edge.fromNode)
    const to = nodeMap.get(edge.toNode)
    if (from && to) {
      const startX = from.x + from.width
      const startY = from.y + from.height / 2
      const endX = to.x
      const endY = to.y + to.height / 2
      elements.push({
        id: `arrow_${edge.id || index}`,
        type: "arrow",
        x: startX,
        y: startY,
        width: endX - startX,
        height: endY - startY,
        points: [
          [0, 0],
          [endX - startX, endY - startY]
        ],
        strokeColor: "#1e1e1e",
        strokeWidth: 2,
        roughness: 1,
        isDeleted: false
      })
    }
  })

  return elements
}
