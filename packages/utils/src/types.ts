/** 跨平台文件树数据节点，不依赖 React 或 Electron。 */
export interface FileTreeNode {
  /** 用于展示的文件或目录名称。 */
  name: string
  /** 文件系统路径，也是节点标识。 */
  path: string
  /** 节点类型；旧扫描数据允许省略。 */
  type?: "file" | "directory"
  /** 已加载子节点；undefined 不代表目录为空。 */
  children?: FileTreeNode[]
}
