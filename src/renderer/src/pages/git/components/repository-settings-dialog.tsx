import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { ScrollArea } from "@/components/ui/scroll-area"
import type { GitRepositorySettings } from "@vessel/type/git"
import { FileText, Cloud, LockKeyhole, Settings2, Plus, Trash2, Loader2 } from "lucide-react"
import { useEffect, useState } from "react"

const tabs = [
  ["template", "提交模板", FileText],
  ["remotes", "远程仓库", Cloud],
  ["security", "安全", LockKeyhole],
  ["advanced", "高级", Settings2]
] as const

/** Edit repository-local settings in a tabbed modal, applying drafts only on confirmation. */
export function RepositorySettingsDialog({ open, repoPath, onOpenChange, onSaved }: { open: boolean; repoPath: string; onOpenChange: (open: boolean) => void; onSaved: (settings: GitRepositorySettings) => void }) {
  const [tab, setTab] = useState<(typeof tabs)[number][0]>("template")
  const [draft, setDraft] = useState<GitRepositorySettings | null>(null)
  const [error, setError] = useState("")
  const [saving, setSaving] = useState(false)
  useEffect(() => {
    if (!open) return
    let cancelled = false
    setDraft(null)
    setError("")
    setTab("template")
    window.electronAPI.git
      .getRepositorySettings(repoPath)
      .then((settings) => {
        if (!cancelled) setDraft(settings)
      })
      .catch((reason) => {
        if (!cancelled) setError(String(reason))
      })
    return () => {
      cancelled = true
    }
  }, [open, repoPath])
  const change = (patch: Partial<GitRepositorySettings>) => setDraft((value) => (value ? { ...value, ...patch } : value))
  const save = async () => {
    if (!draft || saving) return
    setSaving(true)
    setError("")
    try {
      await window.electronAPI.git.saveRepositorySettings(repoPath, draft)
      onSaved(draft)
      onOpenChange(false)
    } catch (reason) {
      setError(String(reason).replace(/^Error: /, ""))
    } finally {
      setSaving(false)
    }
  }
  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        if (!saving) onOpenChange(value)
      }}
    >
      <DialogContent
        showCloseButton={false}
        className="git-dialog git-repository-settings flex h-[min(580px,85vh)] max-w-[720px] flex-col gap-0 overflow-hidden rounded-2xl p-0"
        aria-describedby={undefined}
      >
        <header className="flex shrink-0 items-center gap-4 border-b bg-stone-50 px-5 py-3 dark:border-stone-700 dark:bg-[#262b32]">
          <DialogTitle className="mr-auto text-base">{tabs.find(([id]) => id === tab)?.[1]}</DialogTitle>
          <div
            role="tablist"
            aria-label="仓库设置栏目"
            className="flex gap-1"
          >
            {tabs.map(([id, label, Icon]) => (
              <button
                key={id}
                role="tab"
                id={`git-settings-tab-${id}`}
                aria-controls={`git-settings-panel-${id}`}
                aria-selected={tab === id}
                className="git-settings-tab flex min-w-16 flex-col items-center gap-1 rounded-lg px-2 py-2 text-xs text-stone-500"
                onClick={() => setTab(id)}
              >
                <Icon className="size-4" />
                {label}
              </button>
            ))}
          </div>
        </header>
        <div className="border-b px-5 py-2 text-[11px] text-stone-400 dark:border-stone-700">
          <span
            className="block truncate"
            data-title={repoPath}
          >
            {repoPath}
          </span>
        </div>
        <ScrollArea className="min-h-0 flex-1 [&_[data-radix-scroll-area-viewport]>div]:!block">
          <div
            role="tabpanel"
            id={`git-settings-panel-${tab}`}
            aria-labelledby={`git-settings-tab-${tab}`}
            className="space-y-4 p-5 text-xs"
          >
            {!draft && !error && (
              <p className="flex items-center gap-2 text-stone-500">
                <Loader2 className="size-4 animate-spin" />
                正在读取仓库配置…
              </p>
            )}
            {draft && tab === "template" && (
              <>
                <p className="text-stone-500">为当前仓库预填提交信息。模板保留为纯文本，可使用 Markdown 编写。</p>
                {(
                  [
                    ["none", "不使用模板"],
                    ["default", "使用 Git 默认模板"],
                    ["custom", "自定义（仅当前仓库）"]
                  ] as const
                ).map(([mode, label]) => (
                  <label
                    key={mode}
                    className="flex items-center gap-2"
                  >
                    <input
                      type="radio"
                      name="git-template"
                      checked={draft.templateMode === mode}
                      onChange={() => change({ templateMode: mode })}
                    />
                    {label}
                  </label>
                ))}
                <textarea
                  aria-label="提交模板内容"
                  className="git-settings-input min-h-48 w-full resize-y font-mono"
                  disabled={draft.templateMode !== "custom"}
                  value={draft.template}
                  placeholder="feat: 简要描述本次变更\n\n变更说明：\n验证结果："
                  onChange={(event) => change({ template: event.target.value })}
                />
              </>
            )}
            {draft && tab === "remotes" && (
              <>
                <p className="text-stone-500">管理此仓库的远程地址，支持 SSH 和 HTTPS。修改将在点击“确定”后生效。</p>
                <div className="overflow-hidden rounded-lg border dark:border-stone-700">
                  <div className="grid grid-cols-[110px_1fr_28px] gap-2 bg-stone-50 px-3 py-2 font-medium dark:bg-[#262b32]">
                    <span>名称</span>
                    <span>远程地址</span>
                  </div>
                  {draft.remotes.map((remote, index) => (
                    <div
                      key={index}
                      className="grid grid-cols-[110px_1fr_28px] items-center gap-2 border-t p-2 dark:border-stone-700"
                    >
                      <input
                        aria-label={`远程名称 ${index + 1}`}
                        className="git-settings-input min-w-0"
                        value={remote.name}
                        onChange={(event) => change({ remotes: draft.remotes.map((item, i) => (i === index ? { ...item, name: event.target.value } : item)) })}
                      />
                      <input
                        aria-label={`远程地址 ${index + 1}`}
                        className="git-settings-input min-w-0"
                        value={remote.url}
                        onChange={(event) => change({ remotes: draft.remotes.map((item, i) => (i === index ? { ...item, url: event.target.value } : item)) })}
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-7 text-red-500"
                        aria-label={`移除远程 ${remote.name || index + 1}`}
                        onClick={() => change({ remotes: draft.remotes.filter((_, i) => i !== index) })}
                      >
                        <Trash2 className="!size-3.5" />
                      </Button>
                    </div>
                  ))}
                  {!draft.remotes.length && <p className="p-6 text-center text-stone-400">尚未配置远程仓库</p>}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => change({ remotes: [...draft.remotes, { name: "", url: "" }] })}
                >
                  <Plus className="size-3.5" />
                  添加远程仓库
                </Button>
              </>
            )}
            {draft && tab === "security" && (
              <>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={draft.signCommits}
                    onChange={(event) => change({ signCommits: event.target.checked })}
                  />
                  启用提交签名
                </label>
                <p className="text-stone-500">使用本机 Git 已配置的签名程序和密钥。此处只保存仓库签名配置，不生成或导入私钥。</p>
                <label className="block space-y-2">
                  <span>签名密钥 ID / 公钥路径</span>
                  <input
                    aria-label="签名密钥"
                    className="git-settings-input w-full"
                    value={draft.signingKey}
                    onChange={(event) => change({ signingKey: event.target.value })}
                    placeholder="留空时使用 Git 默认密钥"
                  />
                </label>
              </>
            )}
            {draft && tab === "advanced" && (
              <>
                <section className="space-y-3 rounded-lg border p-4 dark:border-stone-700">
                  <h3 className="font-semibold">提交者信息</h3>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={draft.useGlobalIdentity}
                      onChange={(event) => change({ useGlobalIdentity: event.target.checked })}
                    />
                    使用全局用户设置
                  </label>
                  <label className="block space-y-1.5">
                    <span>姓名</span>
                    <input
                      aria-label="提交者姓名"
                      className="git-settings-input w-full"
                      disabled={draft.useGlobalIdentity}
                      value={draft.useGlobalIdentity ? draft.globalName : draft.userName}
                      onChange={(event) => change({ userName: event.target.value })}
                    />
                  </label>
                  <label className="block space-y-1.5">
                    <span>电子邮件</span>
                    <input
                      aria-label="提交者电子邮件"
                      className="git-settings-input w-full"
                      disabled={draft.useGlobalIdentity}
                      value={draft.useGlobalIdentity ? draft.globalEmail : draft.userEmail}
                      onChange={(event) => change({ userEmail: event.target.value })}
                    />
                  </label>
                </section>
                <section className="space-y-2">
                  <h3 className="font-semibold">仓库忽略规则 · .gitignore</h3>
                  <textarea
                    aria-label="仓库忽略规则"
                    className="git-settings-input min-h-36 w-full resize-y font-mono"
                    value={draft.ignore}
                    onChange={(event) => change({ ignore: event.target.value })}
                  />
                </section>
              </>
            )}
            {error && (
              <p
                role="alert"
                className="whitespace-pre-wrap break-words text-red-500"
              >
                {error}
              </p>
            )}
          </div>
        </ScrollArea>
        <footer className="flex shrink-0 justify-end gap-2 border-t px-5 py-3 dark:border-stone-700">
          <Button
            variant="outline"
            size="sm"
            disabled={saving}
            onClick={() => onOpenChange(false)}
          >
            取消
          </Button>
          <Button
            size="sm"
            className="bg-green-600 text-white hover:bg-green-700"
            disabled={!draft || saving}
            onClick={() => void save()}
          >
            {saving ? "正在保存…" : "确定"}
          </Button>
        </footer>
      </DialogContent>
    </Dialog>
  )
}
