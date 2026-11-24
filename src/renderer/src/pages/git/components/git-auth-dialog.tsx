import "./create-tag-dialog.css"
import { useEffect, useRef, useState } from "react"
import { toast } from "@/components/ui/sonner"
import { KeyRound } from "lucide-react"
import { Dialog, DialogContent } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { RemoteDialogFooter, RemoteDialogHeader } from "./remote-dialog-layout"

type Request = { id: string; host: string; password: boolean }
export function GitAuthDialog() {
  const [requests, setRequests] = useState<Request[]>([])
  const pending = useRef(new Set<string>())
  useEffect(() => {
    const api = window.electronAPI.git
    const off = api.onAuthRequest?.(request => {
      pending.current.add(request.id)
      setRequests(current => [...current.filter(item => item.id !== request.id), request])
    })
    const dismiss = api.onAuthDismiss?.(id => {
      pending.current.delete(id)
      setRequests(current => current.filter(item => item.id !== id))
    })
    const warning = api.onAuthWarning?.(message => toast.warning(message))
    const ids = pending.current
    return () => { off?.(); dismiss?.(); warning?.(); ids.forEach(id => api.respondAuth(id, null)); ids.clear() }
  }, [])
  const request = requests[0]
  return request ? <AuthForm key={request.id} request={request} onAnswer={answer => {
    pending.current.delete(request.id)
    window.electronAPI.git.respondAuth(request.id, answer)
    setRequests(current => current.filter(item => item.id !== request.id))
  }} /> : null
}
function AuthForm({ request, onAnswer }: { request: Request; onAnswer: (answer: string | null) => void }) {
  const [value, setValue] = useState("")
  const label = request.password ? "密码或访问令牌" : "用户名"
  return <Dialog open onOpenChange={open => { if (!open) onAnswer(null) }}>
    <DialogContent showCloseButton={false} className="git-dialog git-tag-dialog z-[900] flex max-h-[90vh] w-[460px] max-w-[92vw] flex-col gap-0 overflow-hidden p-0">
      <RemoteDialogHeader icon={<KeyRound className="size-4" />} title="Git 身份验证" description={request.host} />
      <form className="flex min-h-0 flex-1 flex-col" onSubmit={event => { event.preventDefault(); if (value.trim()) onAnswer(value) }}>
        <div className="grid min-h-0 flex-1 grid-cols-[5rem_minmax(0,1fr)] items-center gap-3 px-5 py-4 text-xs">
          <label htmlFor="git-auth-value" className="text-right text-stone-500 dark:text-stone-400">{request.password ? "密码 / 令牌" : label}</label>
          <Input id="git-auth-value" aria-label={label} className="h-8 text-xs md:text-xs" autoFocus type={request.password ? "password" : "text"} autoComplete={request.password ? "current-password" : "username"} value={value} onChange={event => setValue(event.target.value)} placeholder={`输入${label}`} />
        </div>
        <RemoteDialogFooter>
          <Button type="button" variant="outline" size="sm" className="git-tag-cancel h-8 text-xs" onClick={() => onAnswer(null)}>取消</Button>
          <Button type="submit" size="sm" className="git-tag-submit h-8 min-w-16 text-xs" disabled={!value.trim()}>继续</Button>
        </RemoteDialogFooter>
      </form>
    </DialogContent>
  </Dialog>
}
