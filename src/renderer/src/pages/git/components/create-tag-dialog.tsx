import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { cleanGitErrorMessage } from "@/pages/git/utils"
import { toast } from "sonner"

/** Creates a local tag at the commit selected in the history menu. */
export function CreateTagDialog({ repoPath, hash, onClose, onCreated }: { repoPath: string; hash: string; onClose: () => void; onCreated: () => Promise<void> }) {
  const [name, setName] = useState("")
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  return (
    <Dialog open onOpenChange={(open) => { if (!open && !busy) onClose() }}>
      <DialogContent className="git-dialog max-w-sm">
        <DialogHeader>
          <DialogTitle>创建标签</DialogTitle>
          <DialogDescription>在提交 {hash.slice(0, 7)} 上创建本地标签。</DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={(event) => {
          event.preventDefault()
          if (busy || !name.trim()) return
          setBusy(true)
          setError("")
          void window.electronAPI.git.createTag(repoPath, name.trim(), hash).then(async () => {
            toast.success(`已创建标签：${name.trim()}`)
            onClose()
            await onCreated()
          }).catch((reason) => setError(cleanGitErrorMessage(reason))).finally(() => setBusy(false))
        }}>
          <Input autoFocus aria-label="标签名" placeholder="例如 v1.0.1" value={name} disabled={busy} onChange={(event) => setName(event.target.value)} />
          {error && <p role="alert" className="text-xs text-red-600">{error}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" disabled={busy} onClick={onClose}>取消</Button>
            <Button type="submit" disabled={busy || !name.trim()}>{busy ? "正在创建…" : "创建标签"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
