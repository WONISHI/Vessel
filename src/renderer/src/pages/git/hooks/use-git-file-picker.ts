import { useEffect, useLayoutEffect } from "react"
import { GIT_FILE_PICKER_REQUEST, gitPickerEntries, publishGitStatusView, type GitPickerRequest } from "../file-picker-state"
import type { GitPageModel } from "./use-git-page"

/** Supply the titlebar picker from Git status, never from a workspace directory scan. */
export function useGitFilePicker(g: GitPageModel) {
  useLayoutEffect(() => {
    publishGitStatusView(g.activeTab === "status")
    return () => publishGitStatusView(false)
  }, [g.activeTab])
  useEffect(() => {
    const provide = (event: Event) => {
      const request = (event as CustomEvent<GitPickerRequest>).detail
      request({ repoPath: g.repoPath, entries: gitPickerEntries(g.status), activeId: g.selectedFile ? `${g.activeFileSection === "staged" ? "staged" : "worktree"}:${g.selectedFile.path}` : undefined, select: entry => {
        g.setActiveTab("status")
        g.setActiveFileSection(entry.section)
        g.setSelectedStagedPaths(entry.section === "staged" ? [entry.file.path] : [])
        g.setSelectedUnstagedPaths(entry.section === "unstaged" ? [entry.file.path] : [])
        g.setSelectedConflictPaths(entry.section === "conflicts" ? [entry.file.path] : [])
        if (entry.section === "staged") g.setStagedFileQuery("")
        else g.setUnstagedFileQuery("")
        g.setSelectedFile(entry.file)
      } })
    }
    window.addEventListener(GIT_FILE_PICKER_REQUEST, provide)
    return () => window.removeEventListener(GIT_FILE_PICKER_REQUEST, provide)
  }, [g])
}
