import { useCallback, useEffect, useRef, useState } from 'react'
import type { DatabaseSyncConfig, DatabaseSyncStatus } from '@vessel/type/database-sync'
import { Button } from '@/components/ui/button'
import { ConfirmDialog } from '@/components/ui/confirm-dialog'
import { Input } from '@/components/ui/input'
import { Row } from './row'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Upload, Link, ArrowLeft, ArrowRight, CheckCircle2, LogOut, ShieldCheck, Plus } from 'lucide-react'
import Logo from '@/assets/logo.png'
import { emptyDatabaseSyncConfig, parseDatabaseConnection } from './database-sync-config'
import './database-sync.css'
import { DatabaseInitializationToast } from './database-initialization-toast'
import { showDatabaseSyncError } from './database-sync-error'
import { RegistrationLoginToast } from './registration-login-toast'

export function DatabaseSyncSettings({ standaloneLogin = false, onAuthenticated, onRequestLogin, onAddUserDomain, initialMode }: { standaloneLogin?: boolean; onAuthenticated?: () => void; onRequestLogin?: () => void; onAddUserDomain?: () => void; initialMode?: 'register' | 'login' }) {
  const [status, setStatus] = useState<DatabaseSyncStatus>({ configured: false, connected: false })
  const [config, setConfig] = useState<DatabaseSyncConfig>({ ...emptyDatabaseSyncConfig })
  const [connection, setConnection] = useState('')
  const [step, setStep] = useState<'configure' | 'account' | 'ready'>(standaloneLogin ? 'account' : 'configure')
  const [mode, setMode] = useState<'register' | 'login'>(initialMode ?? (standaloneLogin ? 'login' : 'register'))
  const [name, setName] = useState(''), [password, setPassword] = useState(''), [repeat, setRepeat] = useState('')
  const [busy, setBusy] = useState(false), [message, setMessage] = useState('')
  const [confirmLocalSync, setConfirmLocalSync] = useState(false)
  const [loading, setLoading] = useState(!standaloneLogin)
  const [registrationLogin, setRegistrationLogin] = useState<{ name: string; password: string }>()
  const cancelRegistrationLogin = useCallback(() => setRegistrationLogin(undefined), [])
  const completeRegistrationLogin = useCallback((value: DatabaseSyncStatus) => {
    setRegistrationLogin(undefined); setStatus(value); setPassword(''); setRepeat('')
    if (!value.initializationRequired) {
      setStep('ready'); setMessage('登录成功，当前使用远程数据库')
      if (!standaloneLogin || value.source !== 'remote') onAuthenticated?.()
    }
  }, [standaloneLogin, onAuthenticated])
  const file = useRef<HTMLInputElement>(null)
  useEffect(() => {
    let active = true
    const refresh = () => { void window.electronAPI.databaseSync.status().then(value => {
      if (!active) return
      setStatus(value)
      if (value.config) setConfig({ ...value.config, password: '' })
      if (!standaloneLogin) setStep(value.user ? 'ready' : value.connected ? 'account' : 'configure')
    }).catch(reason => { if (active) showDatabaseSyncError(reason) }).finally(() => { if (active) setLoading(false) })
    }
    refresh()
    const deleted = () => { setMessage(''); refresh() }
    window.addEventListener('vessel:database-data-deleted', deleted)
    return () => { active = false; window.removeEventListener('vessel:database-data-deleted', deleted) }
  }, [standaloneLogin])
  const run = async (action: () => Promise<void>) => {
    if (busy) return
    setBusy(true); setMessage('')
    try { await action() } catch (reason) { showDatabaseSyncError(reason) }
    finally { setBusy(false) }
  }
  const connect = (saved = false) => void run(async () => {
    const value = await window.electronAPI.databaseSync.connect(saved ? undefined : config)
    setStatus(value); setStep('account'); setMode('register'); setConfig(current => ({ ...current, password: '' })); setConnection('')
    setMessage('数据库已连接，所需同步表已准备就绪。请注册同步账号，已有账号可直接登录。')
    onRequestLogin?.()
  })
  if (loading) return <p role="status">正在读取自定域同步配置…</p>
  return <section className="database-sync-settings">
    <ConfirmDialog open={confirmLocalSync} onOpenChange={setConfirmLocalSync} title="同步本地数据库到远程" description="将本机数据库内容同步到当前账号，覆盖远程对应表的数据。本机数据保持不变，不包含密码保险库。" confirmText={busy ? '正在同步…' : '确认同步'} tone="primary" busy={busy} onConfirm={() => void run(async () => {
      const result = await window.electronAPI.databaseSync.syncLocal()
      setStatus(current => ({ ...current, lastSync: result }))
      setConfirmLocalSync(false)
      // The main process reloads every window; its completed-sync flag shows Sonner in the new document.
    })} />
    {registrationLogin && <RegistrationLoginToast credentials={registrationLogin} onCancel={cancelRegistrationLogin} onComplete={completeRegistrationLogin} />}
    {status.initializationRequired && <DatabaseInitializationToast onComplete={value => {
      setStatus(value); setStep('ready'); setMessage('登录成功，当前使用远程数据库')
      if (!standaloneLogin || value.source !== 'remote') onAuthenticated?.()
    }} />}
    {message && <p role="status" className="db-sync-message">{message}</p>}
    {step === 'configure' && <>
      <input hidden ref={file} type="file" accept=".json,.txt,.env" aria-label="数据库连接配置文件" onChange={event => { const picked = event.target.files?.[0]; event.target.value = ''; if (!picked) return; void run(async () => { if (picked.size > 65536) throw new Error('配置文件不能超过 64 KB'); setConfig(parseDatabaseConnection(await picked.text())); setMessage('配置已填入，请检查后连接数据库') }) }} />
      <div className="settings-card">
        <Row title="导入连接配置" description="从 JSON、TXT 或 ENV 文件读取数据库连接信息">
          <Button size="sm" variant="outline" disabled={busy} onClick={() => file.current?.click()}><Upload size={14} />导入配置</Button>
        </Row>
        <Row className="db-sync-connection-row" title="连接字符串" description="粘贴 PostgreSQL 连接地址，自动填写下方配置">
          <div className="db-sync-connection">
            <textarea aria-label="数据库连接字符串" className="vessel-field font-mono" rows={2} value={connection} onChange={event => setConnection(event.target.value)} placeholder="postgresql://用户名:密码@主机/数据库名" />
            <Button size="sm" variant="outline" disabled={busy || !connection.trim()} onClick={() => { try { setConfig(parseDatabaseConnection(connection)); setConnection(''); setMessage('已解析到下方配置') } catch (reason) { showDatabaseSyncError(reason) } }}><Link size={13} />解析连接字符串</Button>
          </div>
        </Row>
      </div>
      <form onSubmit={event => { event.preventDefault(); connect() }}>
        <div className="settings-card">
          <Row title="数据库类型" description="目前支持 PostgreSQL 数据库">
            <Select value={config.type} onValueChange={value => { if (value === 'postgresql') setConfig({ ...config, type: value }) }}><SelectTrigger aria-label="数据库类型" className="db-sync-select"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="postgresql">PostgreSQL</SelectItem></SelectContent></Select>
          </Row>
          <Row title="主机地址" description="数据库服务器的域名或 IP 地址"><Input aria-label="主机地址（Host）" required value={config.host} onChange={e => setConfig({ ...config, host: e.target.value })} placeholder="db.example.com" /></Row>
          <Row title="端口" description="PostgreSQL 默认使用 5432"><Input aria-label="端口（Port）" required type="number" min={1} max={65535} value={config.port} onChange={e => setConfig({ ...config, port: Number(e.target.value) })} /></Row>
          <Row title="数据库名" description="用于保存同步数据的目标数据库"><Input aria-label="数据库名（Database）" required value={config.database} onChange={e => setConfig({ ...config, database: e.target.value })} placeholder="neondb" /></Row>
          <Row title="用户名" description="用于连接数据库的角色名称"><Input aria-label="数据库用户名" required autoComplete="off" value={config.username} onChange={e => setConfig({ ...config, username: e.target.value })} /></Row>
          <Row title="密码" description="仅在本次运行中使用，不保存在本机"><Input aria-label="数据库密码" type="password" autoComplete="new-password" value={config.password} onChange={e => setConfig({ ...config, password: e.target.value })} /></Row>
          <Row title="SSL 模式" description="设置数据库连接的加密与证书校验方式">
            <Select value={config.sslmode} onValueChange={value => { if (value) setConfig({ ...config, sslmode: value as DatabaseSyncConfig['sslmode'] }) }}><SelectTrigger aria-label="SSL 模式" className="db-sync-select"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="require">加密连接</SelectItem><SelectItem value="verify-full">加密并校验证书</SelectItem><SelectItem value="disable">不加密</SelectItem></SelectContent></Select>
          </Row>
          <Row title="连接超时" description="等待数据库建立连接的最长时间，单位为秒"><Input aria-label="连接超时（秒）" required type="number" min={1} max={120} value={config.connectTimeout} onChange={e => setConfig({ ...config, connectTimeout: Number(e.target.value) })} /></Row>
        </div>
        <div className="db-sync-config-footer"><p>连接成功后准备同步表，再进入注册登录。</p><div>{status.configured && <Button type="button" size="sm" variant="outline" disabled={busy} onClick={() => connect(true)}>使用已保存的连接</Button>}<Button type="submit" size="sm" disabled={busy}>{busy ? '连接并准备数据表…' : '连接并创建同步表'}<ArrowRight size={14} /></Button></div></div>
      </form>
    </>}
    {step === 'account' && <div className="db-sync-auth">
      <div className="db-sync-auth-brand">
        <div className="db-sync-auth-logo"><img src={Logo} alt="Vessel" /></div>
        <div className="db-sync-auth-copy"><h3>让你的数据<br />有一个远方的副本。</h3><p>本地优先，按需同步。<br />使用独立同步账号，管理你的个人数据。</p></div>
        <span className="db-sync-auth-feature"><ShieldCheck size={18} />按账号与设备隔离同步副本</span>
      </div>
      <form className="db-sync-auth-form" onSubmit={event => { event.preventDefault(); void run(async () => {
        setRegistrationLogin(undefined)
        if (mode === 'register' && password !== repeat) throw new Error('两次输入的密码不一致')
        if (standaloneLogin && !status.connected) {
          setStatus(await window.electronAPI.databaseSync.connect(undefined, status.domain))
        }
        const value = await window.electronAPI.databaseSync.authenticate(mode, name, password)
        setStatus(value); setRepeat('')
        if (mode === 'login') setPassword('')
        if (mode === 'register') { setMode('login'); setRegistrationLogin({ name, password }) } else if (!value.initializationRequired) { setStep('ready'); setMessage('登录成功，当前使用远程数据库'); if (!standaloneLogin || value.source !== 'remote') onAuthenticated?.() }
      }) }}>
        <span className="text-xs font-medium text-green-600">{standaloneLogin ? '账号登录' : '数据库已连接 · 同步表已就绪'}</span><h3>{mode === 'register' ? '创建同步账号' : '欢迎回来'}</h3><p className="text-xs text-muted-foreground">{status.domain === 'user' ? '当前使用用户域，使用该域的账号密码登录，无需再次填写数据库密码。' : '当前使用系统域，使用账号密码登录即可，无需填写数据库密码。'}</p>
        {standaloneLogin && status.userConfigured && <label className="db-sync-label">登录域<Select value={status.domain ?? 'user'} onValueChange={value => {
          if (value !== 'user' && value !== 'system') return
          setRegistrationLogin(undefined)
          setStatus(current => ({ ...current, domain: value, connected: false, configured: value === 'user' ? !!current.userConfigured : !!current.systemAvailable }))
          setPassword(''); setRepeat('')
        }}><SelectTrigger aria-label="登录域"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="system" disabled={!status.systemAvailable}>系统域</SelectItem><SelectItem value="user">用户域</SelectItem></SelectContent></Select></label>}
        <label className="db-sync-label">账号<Input placeholder="请输入账号" autoComplete="username" required minLength={2} maxLength={80} value={name} onChange={e => setName(e.target.value)} /></label>
        <label className="db-sync-label">密码<Input placeholder="请输入密码（至少 8 位）" type="password" autoComplete={mode === 'register' ? 'new-password' : 'current-password'} required minLength={8} maxLength={256} value={password} onChange={e => setPassword(e.target.value)} /></label>
        {mode === 'register' && <label className="db-sync-label">确认密码<Input placeholder="请再次输入密码" type="password" autoComplete="new-password" required value={repeat} onChange={e => setRepeat(e.target.value)} /></label>}
        <Button type="submit" disabled={busy || status.initializationRequired}>{status.initializationRequired ? '请选择是否同步本地数据' : busy ? '正在处理…' : mode === 'register' ? '注册账号' : '登录'}<ArrowRight size={14} /></Button>
        <div className="db-sync-auth-links">
        <button type="button" className="text-sm text-green-600" disabled={busy} onClick={() => { setRegistrationLogin(undefined); setMode(mode === 'register' ? 'login' : 'register'); setPassword(''); setRepeat('') }}>{mode === 'register' ? '已有账号？去登录' : '还没有账号？去注册'}</button>
        {standaloneLogin && <button type="button" className="db-sync-add-domain" disabled={busy} onClick={onAddUserDomain}><Plus size={14} />添加用户域</button>}
        </div>
        {!standaloneLogin && <button type="button" className="flex items-center gap-1 text-xs text-muted-foreground" disabled={busy} onClick={() => setStep('configure')}><ArrowLeft size={12} />返回连接配置</button>}
      </form>
    </div>}
    {step === 'ready' && <div className="settings-card p-6">
      <div className="flex items-center gap-3"><CheckCircle2 className="text-green-600" size={24} /><div><h3>已登录 · {status.user?.name}</h3><p className="mt-1 text-xs text-muted-foreground">{status.config?.host} / {status.config?.database}</p></div></div>
      <p className="my-5 text-sm leading-7 text-muted-foreground">当前直接读写远程数据库，包括应用状态、工作区记录、浏览记录、剪贴板、待办和 API 数据。不同账号的数据相互隔离，退出登录后恢复本机原有数据。</p>
      <div className="flex flex-wrap gap-2">
        <Button className="bg-zinc-900 text-white hover:bg-zinc-800 hover:text-white" disabled={busy} onClick={() => void run(async () => { setStatus(await window.electronAPI.databaseSync.logout()); setStep('account'); setMode('login') })}><LogOut size={14} />退出登录并使用本地数据</Button>
        <Button variant="outline" className="hover:bg-stone-200 hover:text-foreground dark:hover:bg-white/10" disabled={busy} onClick={() => void run(async () => { setStatus(await window.electronAPI.databaseSync.disconnect()); setStep('configure') })}>更换数据库</Button>
        <Button variant="outline" className="hover:bg-stone-200 hover:text-foreground dark:hover:bg-white/10" disabled={busy} onClick={() => setConfirmLocalSync(true)}><Upload size={14} />同步本地数据库到远程</Button>
      </div>
      {status.lastSync && <p className="mt-5 text-xs text-muted-foreground">最近同步：{new Date(status.lastSync.at).toLocaleString()} · {status.lastSync.tables} 张表 · {status.lastSync.rows.toLocaleString()} 行</p>}
      <p className="mt-4 text-xs leading-6 text-muted-foreground">远程连接失败时不会自动改写本地数据库。磁盘上的笔记、附件及下载文件仍保存在原有位置。</p>
    </div>}
  </section>
}
