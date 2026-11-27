import { useRef, useState } from 'react'
import { useRouter } from '@vessel/react-router'
import type { DatabaseSyncConfig } from '@vessel/type/database-sync'
import { ArrowLeft, ArrowRight, Database, LoaderCircle, Upload } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { emptyDatabaseSyncConfig, parseDatabaseConnection } from '@/pages/settings/components/database-sync-config'
import './user-domain.css'

export default function UserDomainPage() {
  const router = useRouter()
  const file = useRef<HTMLInputElement>(null)
  const [mode, setMode] = useState<'connection' | 'manual'>('connection')
  const [connection, setConnection] = useState('')
  const [config, setConfig] = useState<DatabaseSyncConfig>({ ...emptyDatabaseSyncConfig })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const update = <K extends keyof DatabaseSyncConfig>(key: K, value: DatabaseSyncConfig[K]) => setConfig(current => ({ ...current, [key]: value }))
  const run = async (action: () => Promise<void>) => {
    if (busy) return
    setBusy(true); setError(''); setNotice('')
    try { await action() } catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)) }
    finally { setBusy(false) }
  }
  const changeMode = (next: typeof mode) => {
    if (mode === 'connection' && next === 'manual' && connection.trim()) {
      try { setConfig(parseDatabaseConnection(connection)); setConnection('') }
      catch (reason) { setError(reason instanceof Error ? reason.message : String(reason)); return }
    }
    setMode(next); setError(''); setNotice('')
  }
  return <ScrollArea className="user-domain-page h-dvh w-full">
    <main className="user-domain-shell">
      <button type="button" className="user-domain-back" disabled={busy} onClick={() => { void router.replace('/login') }}><ArrowLeft size={15} />返回登录</button>
      <div className="user-domain-panel">
        <header className="user-domain-header">
          <Database size={30} strokeWidth={1.7} />
          <div><h1>添加用户域</h1><p>连接自己的数据库，让数据保存在你选择的地方。</p></div>
        </header>
        <form onSubmit={event => { event.preventDefault(); void run(async () => {
          const value = mode === 'connection' ? parseDatabaseConnection(connection) : config
          await window.electronAPI.databaseSync.connect(value)
          setConnection(''); setConfig(current => ({ ...current, password: '' }))
          await router.replace('/login?mode=register')
        }) }}>
          <fieldset disabled={busy}>
            <div className="user-domain-methods">
              <div className="user-domain-mode" aria-label="连接方式">
                <button type="button" aria-pressed={mode === 'connection'} onClick={() => changeMode('connection')}>连接字符串</button>
                <button type="button" aria-pressed={mode === 'manual'} onClick={() => changeMode('manual')}>手动填写</button>
              </div>
              <Button type="button" variant="ghost" size="sm" onClick={() => file.current?.click()}><Upload size={14} />导入配置</Button>
              <input hidden ref={file} type="file" accept=".json,.txt,.env" aria-label="用户域配置文件" onChange={event => {
                const picked = event.target.files?.[0]; event.target.value = ''; if (!picked) return
                void run(async () => {
                  if (picked.size > 65536) throw new Error('配置文件不能超过 64 KB')
                  setConfig(parseDatabaseConnection(await picked.text())); setConnection(''); setMode('manual'); setNotice('配置已导入，请检查后连接。')
                })
              }} />
            </div>
            {mode === 'connection' ? <div className="user-domain-connection">
              <label htmlFor="user-domain-uri">PostgreSQL 连接字符串</label>
              <textarea id="user-domain-uri" required rows={3} value={connection} onChange={event => setConnection(event.target.value)} placeholder="postgresql://用户名:密码@主机:5432/数据库名" autoComplete="off" spellCheck={false} />
              <p>粘贴完整连接地址，或导入 JSON、TXT、ENV 配置文件。</p>
            </div> : <div className="user-domain-fields">
              <label>数据库类型<Select value={config.type} onValueChange={value => { if (value === 'postgresql') update('type', value) }}><SelectTrigger aria-label="数据库类型"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="postgresql">PostgreSQL</SelectItem></SelectContent></Select></label>
              <label>数据库名<Input required value={config.database} onChange={e => update('database', e.target.value)} placeholder="例如 neondb" /></label>
              <label className="user-domain-host">主机地址<Input required value={config.host} onChange={e => update('host', e.target.value)} placeholder="db.example.com" /></label>
              <label>端口<Input required type="number" min={1} max={65535} value={config.port} onChange={e => update('port', Number(e.target.value))} /></label>
              <label>用户名<Input required autoComplete="off" value={config.username} onChange={e => update('username', e.target.value)} placeholder="数据库用户名" /></label>
              <label>数据库密码<Input type="password" autoComplete="new-password" value={config.password} onChange={e => update('password', e.target.value)} placeholder="数据库密码" /></label>
              <label>SSL 模式<Select value={config.sslmode} onValueChange={value => { if (value) update('sslmode', value as DatabaseSyncConfig['sslmode']) }}><SelectTrigger aria-label="SSL 模式"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="require">加密连接</SelectItem><SelectItem value="verify-full">加密并校验证书</SelectItem><SelectItem value="disable">不加密</SelectItem></SelectContent></Select></label>
              <label>连接超时（秒）<Input required type="number" min={1} max={120} value={config.connectTimeout} onChange={e => update('connectTimeout', Number(e.target.value))} /></label>
            </div>}
            {notice && <p role="status" className="user-domain-notice">{notice}</p>}
            {error && <p role="alert" className="user-domain-error">{error}</p>}
            <footer className="user-domain-footer"><p>连接成功后自动准备同步表，接着注册或登录。</p><Button type="submit" disabled={busy || (mode === 'connection' && !connection.trim())}>{busy ? <LoaderCircle size={15} className="animate-spin" /> : null}{busy ? '正在连接…' : '连接并继续'}{!busy && <ArrowRight size={15} />}</Button></footer>
          </fieldset>
        </form>
      </div>
      <p className="user-domain-security">连接配置仅在本次运行中使用，不保存到本机；重新打开应用后需再次填写。</p>
    </main>
  </ScrollArea>
}
