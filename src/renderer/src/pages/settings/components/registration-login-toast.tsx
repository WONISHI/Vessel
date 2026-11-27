import { useEffect } from 'react'
import type { DatabaseSyncStatus } from '@vessel/type/database-sync'
import { toast } from '@/components/ui/sonner'
import { showDatabaseSyncError } from './database-sync-error'

export function RegistrationLoginToast({ credentials, onComplete, onCancel }: {
  credentials: { name: string; password: string }
  onComplete: (status: DatabaseSyncStatus) => void
  onCancel: () => void
}) {
  useEffect(() => {
    const id = 'database-registration-login'
    let active = true, busy = false
    const login = async () => {
      if (!active || busy) return
      busy = true
      toast.success('正在登录…', { id, duration: Infinity, dismissible: false, closeButton: false, action: undefined, cancel: undefined, onDismiss: undefined })
      try {
        const status = await window.electronAPI.databaseSync.authenticate('login', credentials.name, credentials.password)
        if (active) { toast.dismiss(id); onComplete(status) }
      } catch (error) {
        if (active) { showPrompt(); showDatabaseSyncError(error) }
      } finally { busy = false }
    }
    const showPrompt = () => toast.success('注册成功，是否直接登录？', {
      id, duration: Infinity, dismissible: true, closeButton: true, onDismiss: onCancel,
      action: { label: '立即登录', onClick: event => { event.preventDefault(); void login() } },
      cancel: { label: '稍后登录', onClick: onCancel }
    })
    showPrompt()
    return () => { active = false; toast.dismiss(id) }
  }, [credentials, onComplete, onCancel])
  return null
}
