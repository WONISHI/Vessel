import { useMemo, useSyncExternalStore, type Dispatch, type SetStateAction } from 'react'
import { getGitFileSelection, subscribeGitFileSelection, updateGitFileSelection, type GitFileSelectionState } from '../file-selection-state'

/** Selection belongs to the repository, not the lifetime of the Git route component. */
export function useGitSelectionState(repoPath: string) {
 const snapshot = useSyncExternalStore(
  (listener) => subscribeGitFileSelection(repoPath, listener),
  () => getGitFileSelection(repoPath)
 )
 const setters = useMemo(() => {
  const setter = <K extends keyof GitFileSelectionState>(key: K): Dispatch<SetStateAction<GitFileSelectionState[K]>> => (value) => {
   updateGitFileSelection(repoPath, (previous) => ({ ...previous, [key]: typeof value === 'function' ? (value as (previous: GitFileSelectionState[K]) => GitFileSelectionState[K])(previous[key]) : value }))
  }
  return {
   setSelectedFile: setter('selectedFile'), setSelectedStagedPaths: setter('selectedStagedPaths'), setSelectedUnstagedPaths: setter('selectedUnstagedPaths'), setSelectedConflictPaths: setter('selectedConflictPaths'),
   setActiveFileSection: setter('activeFileSection'), setLastStagedClickedIndex: setter('lastStagedClickedIndex'), setLastUnstagedClickedIndex: setter('lastUnstagedClickedIndex'), setLastConflictClickedIndex: setter('lastConflictClickedIndex')
  }
 }, [repoPath])
 return { ...snapshot, ...setters }
}
