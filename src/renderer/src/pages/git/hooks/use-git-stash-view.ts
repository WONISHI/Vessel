import { useEffect, useRef, useState } from "react"
import type { GitStashDetail, GitStashEntry, GitStashFile } from "@vessel/type"
import type { GitRepositoryState } from "./use-git-repository"
import { cleanGitErrorMessage } from "@/pages/git/utils"

type Preview = { repoPath: string; record: GitStashEntry; detail: GitStashDetail | null; file: GitStashFile | null; diff: string; error: string; diffError: string; loading: boolean; diffLoading: boolean }

/** A read-only saved-tree preview with independent request ordering from live changes. */
export function useGitStashView(repo: GitRepositoryState) {
  const [preview, setPreview] = useState<Preview | null>(null)
  const version = useRef(0)
  const diffVersion = useRef(0)
  useEffect(() => () => { version.current++; diffVersion.current++ }, [repo.repoPath])
  const active = preview?.repoPath === repo.repoPath ? preview : null
  const loadDiff = async (request: number, root: string, detail: GitStashDetail, file: GitStashFile) => {
    const diffRequest = ++diffVersion.current
    setPreview((current) => current && { ...current, file, diff: "", diffError: "", diffLoading: true })
    try {
      const result = await window.electronAPI.git.getStashDiff(root, detail.hash, file.path)
      if (request === version.current && diffRequest === diffVersion.current) setPreview((current) => current && { ...current, diff: result.diff })
    } catch (error) {
      if (request === version.current && diffRequest === diffVersion.current) setPreview((current) => current && { ...current, diffError: cleanGitErrorMessage(error) })
    } finally {
      if (request === version.current && diffRequest === diffVersion.current) setPreview((current) => current && { ...current, diffLoading: false })
    }
  }
  const viewStash = async (record: GitStashEntry) => {
    const root = repo.repoPath
    if (!root) return
    const request = ++version.current
    diffVersion.current++
    repo.setActiveTab("stash")
    setPreview({ repoPath: root, record, detail: null, file: null, diff: "", error: "", diffError: "", loading: true, diffLoading: false })
    try {
      const detail = await window.electronAPI.git.getStashDetail(root, record.hash || record.index)
      if (request !== version.current) return
      setPreview((current) => current && { ...current, record: { ...record, hash: detail.hash }, detail, loading: false })
      if (detail.files[0]) await loadDiff(request, root, detail, detail.files[0])
    } catch (error) {
      if (request === version.current) setPreview((current) => current && { ...current, loading: false, error: cleanGitErrorMessage(error) })
    }
  }
  const selectStashFile = (file: GitStashFile) => {
    if (active?.detail) void loadDiff(version.current, repo.repoPath, active.detail, file)
  }
  return { selectedStash: active?.record, stashDetail: active?.detail, selectedStashFile: active?.file, stashDiffText: active?.diff || "", stashError: active?.error || "", stashDiffError: active?.diffError || "", stashLoading: active?.loading || false, stashDiffLoading: active?.diffLoading || false, viewStash, selectStashFile }
}
