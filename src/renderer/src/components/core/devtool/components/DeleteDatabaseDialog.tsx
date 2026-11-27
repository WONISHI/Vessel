import { useState } from 'react'
import { DATABASE_DELETE_CONFIRMATION, type DatabaseDeleteScope } from '@vessel/type/database-sync'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Trash2 } from 'lucide-react'
import { toast } from 'sonner'
const titles: Record<DatabaseDeleteScope, string> = { local: '删除本地域（数据库）', both: '删除本地域和远程域（数据库）', remote: '删除远程域（数据库）' }
export function DeleteDatabaseDialog({ scope, onClose }: { scope: DatabaseDeleteScope; onClose: () => void }) {
  const [text, setText] = useState(''), [busy, setBusy] = useState(false), [error, setError] = useState('')
  const phrase = DATABASE_DELETE_CONFIRMATION[scope]
  return <Dialog open onOpenChange={open => { if (!open && !busy) onClose() }}>
    <DialogContent className="!z-[400] max-w-md" overlayClassName="!z-[390]" showCloseButton={!busy} onInteractOutside={event => event.preventDefault()} onEscapeKeyDown={event => { if (busy) event.preventDefault() }}>
      <DialogHeader><DialogTitle className="flex items-center gap-2"><Trash2 className="size-4 text-red-600" />{titles[scope]}</DialogTitle><DialogDescription>此操作无法撤销，请核对删除范围后输入确认文字。</DialogDescription></DialogHeader>
      <div className="space-y-3 text-sm leading-6">
        {scope !== 'remote' && <p>清空本机“数据存储”中的 5 个 SQLite 数据库。应用将自动重启，数据库会重新初始化；磁盘上的笔记、附件和下载文件会保留。</p>}
        {scope !== 'local' && <p>清空当前登录同步账号在远程的全部设备副本，保留同步账号及其他账号的数据。</p>}
        <p className="text-muted-foreground">请输入：<strong className="select-all text-foreground">{phrase}</strong></p>
        <Input aria-label="删除数据确认文字" autoComplete="off" value={text} disabled={busy} onChange={event => setText(event.target.value)} placeholder={phrase} />
        {error && <p role="alert" className="text-xs text-red-600">{error}</p>}
      </div>
      <DialogFooter><Button type="button" variant="outline" disabled={busy} onClick={onClose}>取消</Button><Button type="button" variant="destructive" disabled={busy || text !== phrase} onClick={() => {
        if (text !== phrase || busy) return
        setBusy(true); setError('')
        void window.electronAPI.databaseSync.deleteData(scope, text).then(result => {
          toast.success(result.restarting ? '正在重启，随后清空本地数据库' : '远程同步数据已删除')
          window.dispatchEvent(new Event('vessel:database-data-deleted'))
          onClose()
        }).catch(reason => setError(reason instanceof Error ? reason.message : String(reason))).finally(() => setBusy(false))
      }}>{busy ? '正在删除…' : scope === 'remote' ? '确认删除' : '删除并重启'}</Button></DialogFooter>
    </DialogContent>
  </Dialog>
}
