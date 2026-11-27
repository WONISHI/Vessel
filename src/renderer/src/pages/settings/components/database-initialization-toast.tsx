import { useEffect } from 'react'
import type { DatabaseSyncStatus } from '@vessel/type/database-sync'
import { toast } from 'sonner'

const id = 'database-domain-initialization'

export function DatabaseInitializationToast({ onComplete }: { onComplete: (status: DatabaseSyncStatus) => void }) {
  useEffect(() => {
    let busy = false, active = true
    const choose = async (importLocal: boolean) => {
      if (busy || !active) return
      busy = true
      toast(importLocal ? '正在同步本地数据库…' : '正在创建远程空表…', {
        id, duration: Infinity, dismissible: false, closeButton: false,
        description: '完成后将自动进入当前账号的工作区。', action: undefined, cancel: undefined
      })
      try {
        const status = await window.electronAPI.databaseSync.initialize(importLocal)
        if (active) { toast.dismiss(id); onComplete(status) }
      } catch (error) {
        if (active) { showChoice(); toast.error(error instanceof Error ? error.message : '远程数据库初始化失败，请重试') }
      } finally { busy = false }
    }
    const showChoice = () => toast('远程账号暂无数据，是否同步本地数据库？', {
      id, duration: Infinity, dismissible: false, closeButton: false,
      className: '!flex-wrap [&_[data-content]]:!basis-full',
      description: '同意后同步本机业务数据库；不同意则创建空表。密码保险库可在登录后单独授权导入。',
      action: { label: '同意同步', onClick: event => { event.preventDefault(); void choose(true) } },
      // Sonner disables its built-in cancel handler when dismissible=false.
      cancel: <button type="button" data-button data-cancel onClick={event => { event.preventDefault(); void choose(false) }}>不同意，创建空表</button>
    })
    showChoice()
    return () => { active = false; toast.dismiss(id) }
  }, [onComplete])
  return null
}
