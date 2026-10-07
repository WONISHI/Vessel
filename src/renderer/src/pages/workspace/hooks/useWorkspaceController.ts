import { useDirectoryWatch, useFileChanges } from "./file-changes"
import { useEffect, useRef, useState } from "react"
import { useNavigate } from "react-router-dom"
import { getFileExtension } from "@vessel/utils"
import type { WorkspaceData, WorkspaceNode, WorkspaceContextType } from "../types/workspace"

/**
 * 管理工作区标签、当前文件与目录展开状态，实现侧栏和主区联动。
 * @param workspace 当前工作区数据。
 * @returns 提供给页面 Context 的受控状态与操作方法。
 */
export function useWorkspaceController(workspace: WorkspaceData, initialFile?: string, scope: "workspace" | "resources" = "workspace", preview = false, active = true): WorkspaceContextType {
  const activeRef = useRef(active)
  activeRef.current = active
  const initialFileRef = useRef(initialFile)
  const base = scope === "resources" ? "/resources" : "/editor"
  useDirectoryWatch(workspace.path)
  const navigate = useNavigate()
  const [openFiles, setOpenFiles] = useState<WorkspaceNode[]>(() => initialFile ? [{ name: initialFile.split(/[\\/]/).pop() || initialFile, path: initialFile }] : [])
  const [activeFilePath, setActiveFilePath] = useState(initialFile || "")
  const [expandedFolders, setExpandedFolders] = useState<string[]>([])
  const navigateRef = useRef(navigate)
  useEffect(() => { navigateRef.current = navigate }, [navigate])
  const [sessionKey, setSessionKey] = useState("")
  useEffect(() => {
    let cancelled = false
    const restore = async () => {
      const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(workspace.path))
      if (cancelled) return
      const key = `${scope}-tabs:` + Array.from(new Uint8Array(digest), n => n.toString(16).padStart(2, "0")).join("")
      const saved = await window.electronAPI.getAppState<{ files: WorkspaceNode[]; active: string; expanded?: string[] }>(key)
      if (cancelled) return
      if (saved && Array.isArray(saved.files)) {
        const files = saved.files.filter(file => typeof file.path === "string" && typeof file.name === "string")
        setExpandedFolders(saved.expanded || [])
        setOpenFiles(current => [...files, ...current.filter(file => !files.some(item => item.path === file.path))])
        if (!initialFileRef.current && files.some(file => file.path === saved.active)) {
          setActiveFilePath(saved.active)
          if (!preview && activeRef.current) navigateRef.current(`${base}/file`, { replace: true })
        }
      }
      if (!preview) await window.electronAPI.setAppState(`${scope}-last`, { name: workspace.name, path: workspace.path, files: [] })
      if (!cancelled && !preview) setSessionKey(key)
    }
    void restore().catch(error => console.error("恢复工作区标签失败", error))
    return () => { cancelled = true }
  }, [workspace.path, workspace.name, scope, base, preview])
  useEffect(() => {
    if (!sessionKey) return
    void window.electronAPI.setAppState(sessionKey, { files: openFiles.map(({ name, path }) => ({ name, path })), active: activeFilePath, expanded: expandedFolders })
      .catch(error => console.error("保存工作区标签失败", error))
  }, [sessionKey, openFiles, activeFilePath, expandedFolders])
  useEffect(() => {
    if (!initialFile || !active) return
    setOpenFiles(files => files.some(file => file.path === initialFile) ? files : [...files, { path: initialFile, name: initialFile.split(/[\\/]/).pop() || initialFile }])
    setActiveFilePath(initialFile)
  }, [initialFile, active])
  /** 更新目录展开集合，供懒加载树切换可见层级。
   * @param path 目录的唯一文件系统路径。
   * @param open 是否展开目录。 */
  const setDirectoryExpanded = (path: string, open: boolean) => setExpandedFolders((current) => (open ? [...new Set([...current, path])] : current.filter((item) => item !== path)))
  /** 清除当前文件选择并返回工作区首页，保留已打开的标签。 */
  const navigateToWorkspaceHome = () => {
    setActiveFilePath("")
    if (!preview && activeRef.current) navigate(base)
  }
  /** 激活文件标签，避免重复添加，并导航至文件内容路由。
   * @param file 要打开的文件节点。 */
  const openWorkspaceFile = (file: WorkspaceNode) => {
    setOpenFiles((current) => (current.some((item) => item.path === file.path) ? current : [...current, file]))
    setActiveFilePath(file.path)
    if (!preview && activeRef.current) navigate(initialFile && scope === "workspace" ? `/editor/file?external=${encodeURIComponent(initialFile)}` : `${base}/file`)
  }
  /** 关闭指定标签；关闭当前标签时优先选择左侧标签，否则返回首页。
   * @param path 要关闭的文件路径。 */
  const closeWorkspaceFile = (path: string) => {
    const index = openFiles.findIndex((file) => file.path === path)
    const remaining = openFiles.filter((file) => file.path !== path)
    setOpenFiles(remaining)
    if (path === activeFilePath) {
      const next = remaining[Math.max(0, index - 1)]
      if (next) {
        setActiveFilePath(next.path)
        if (!preview && activeRef.current) navigate(initialFile && scope === "workspace" ? `/editor/file?external=${encodeURIComponent(initialFile)}` : `${base}/file`)
      } else navigateToWorkspaceHome()
    }
  }
  /** 批量关闭标签并一次更新列表，避免连续关闭时使用过期状态。 */
  const closeWorkspaceFiles = (paths: string[]) => {
    const removed = new Set(paths)
    const remaining = openFiles.filter((file) => !removed.has(file.path))
    setOpenFiles(remaining)
    if (removed.has(activeFilePath)) {
      const next = remaining[0]
      if (next) {
        setActiveFilePath(next.path)
        if (!preview && activeRef.current) navigate(initialFile && scope === "workspace" ? `/editor/file?external=${encodeURIComponent(initialFile)}` : `${base}/file`)
      } else navigateToWorkspaceHome()
    }
  }
  useFileChanges(changes => {
    const deleted = changes.filter(change => change.type === "delete")
    const removed = openFiles.filter(file => deleted.some(change => file.path === change.path || file.path.startsWith(change.path + "/") || file.path.startsWith(change.path + "\\"))).map(file => file.path)
    if (removed.length) closeWorkspaceFiles(removed)
    setExpandedFolders(current => current.filter(path => !deleted.some(change => path === change.path || path.startsWith(change.path + "/"))))
  })
  return {
    renameWorkspaceTab: (path, newPath, name) => {
      setOpenFiles(files => files.map(file => file.path === path ? { ...file, path: newPath, name } : file))
      if (activeFilePath === path) setActiveFilePath(newPath)
    },
    workspace,
    activeFilePath,
    openFiles,
    expandedFolders,
    openWorkspaceFile,
    closeWorkspaceFile,
    closeWorkspaceFiles,
    navigateToWorkspaceHome,
    setDirectoryExpanded,
    fileType: getFileExtension(activeFilePath),
    expandDirectory: (path) => setDirectoryExpanded(path, true)
  }
}
