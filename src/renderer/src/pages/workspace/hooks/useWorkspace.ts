import { useContext } from "react"
import { WorkspaceContext } from "@/pages/workspace/types/workspace"

/** 读取当前工作区共享状态；必须在 WorkspaceProvider 内调用。
 * @returns 工作区状态及文件、标签、目录操作。
 * @throws 页面缺少 WorkspaceProvider 时抛出错误。
 */
export const useWorkspace = () => {
  const context = useContext(WorkspaceContext)
  if (!context) {
    throw new Error("useWorkspace must be used within WorkspaceProvider")
  }
  return context
}
