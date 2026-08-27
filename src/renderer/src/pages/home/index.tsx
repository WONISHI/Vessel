import { useState, useMemo } from "react"
import { useNavigate } from "react-router-dom"
import { Search, X, Trash2, ChevronRight, Clock, FolderOpen, FileText, Image, Code, Braces, Link, Palette, CheckCircle2, Wrench } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"

// ========== 类型定义 ==========
interface HistoryItem {
  id: string
  name: string
  path: string
  type: "workspace" | "note" | "page" | "image" | "code"
  lastOpened: number
  fileCount?: number
}

interface ToolItem {
  id: string
  name: string
  description: string
  icon: React.ComponentType<{ className?: string }>
  iconBg: string
  iconColor: string
  route: string
}

// ========== 配置 ==========
const typeConfig: Record<
  HistoryItem["type"],
  {
    label: string
    icon: React.ComponentType<{ className?: string }>
    iconBg: string
    iconColor: string
  }
> = {
  workspace: { label: "工作区", icon: FolderOpen, iconBg: "bg-green-50", iconColor: "text-green-700" },
  note: { label: "笔记", icon: FileText, iconBg: "bg-blue-50", iconColor: "text-blue-600" },
  page: { label: "页面", icon: FileText, iconBg: "bg-purple-50", iconColor: "text-purple-600" },
  image: { label: "图片", icon: Image, iconBg: "bg-amber-50", iconColor: "text-amber-600" },
  code: { label: "代码", icon: Code, iconBg: "bg-stone-100", iconColor: "text-stone-600" }
}

const tools: ToolItem[] = [
  { id: "json", name: "JSON", description: "格式化、压缩、校验", icon: Braces, iconBg: "bg-green-50", iconColor: "text-green-700", route: "/tools/json" },
  { id: "base64", name: "Base64", description: "编码与解码", icon: FileText, iconBg: "bg-blue-50", iconColor: "text-blue-600", route: "/tools/base64" },
  { id: "url", name: "URL", description: "编码与解码", icon: Link, iconBg: "bg-purple-50", iconColor: "text-purple-600", route: "/tools/url" },
  { id: "timestamp", name: "时间戳", description: "时间与日期互转", icon: Clock, iconBg: "bg-amber-50", iconColor: "text-amber-600", route: "/tools/timestamp" },
  { id: "color", name: "颜色", description: "HEX/RGB/HSL", icon: Palette, iconBg: "bg-rose-50", iconColor: "text-rose-600", route: "/tools/color" },
  { id: "regex", name: "正则", description: "表达式匹配测试", icon: CheckCircle2, iconBg: "bg-stone-100", iconColor: "text-stone-600", route: "/tools/regex" }
]

const filterOptions: { value: "all" | HistoryItem["type"]; label: string }[] = [
  { value: "all", label: "全部" },
  { value: "workspace", label: "工作区" },
  { value: "note", label: "笔记" },
  { value: "page", label: "页面" },
  { value: "image", label: "图片" },
  { value: "code", label: "代码" }
]

// ========== Mock 数据（实际项目从 dbAPI 读取） ==========
const mockHistory: HistoryItem[] = [
  { id: "1", name: "我的知识管理工作区", path: "/Users/vessel/Documents/knowledge", type: "workspace", lastOpened: Date.now() - 1000 * 60 * 30, fileCount: 128 },
  { id: "2", name: "FlexNote 设计规范.md", path: "/Users/vessel/Documents/knowledge/design/flexnote.md", type: "note", lastOpened: Date.now() - 1000 * 60 * 60 * 2 },
  { id: "3", name: "项目需求文档", path: "/Users/vessel/Documents/work/project-alpha", type: "workspace", lastOpened: Date.now() - 1000 * 60 * 60 * 5, fileCount: 42 },
  { id: "4", name: "API 接口设计.page", path: "/Users/vessel/Documents/knowledge/api/page.json", type: "page", lastOpened: Date.now() - 1000 * 60 * 60 * 26 },
  { id: "5", name: "logo-设计稿.png", path: "/Users/vessel/Documents/design/logo.png", type: "image", lastOpened: Date.now() - 1000 * 60 * 60 * 28 },
  { id: "6", name: "学习笔记工作区", path: "/Users/vessel/Documents/study", type: "workspace", lastOpened: Date.now() - 1000 * 60 * 60 * 24 * 3, fileCount: 86 },
  { id: "7", name: "utils.ts", path: "/Users/vessel/Projects/app/src/utils.ts", type: "code", lastOpened: Date.now() - 1000 * 60 * 60 * 24 * 5 },
  { id: "8", name: "读书笔记：思考快与慢.md", path: "/Users/vessel/Documents/books/thinking-fast-slow.md", type: "note", lastOpened: Date.now() - 1000 * 60 * 60 * 24 * 7 }
]

// ========== 工具函数 ==========
function formatRelativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp
  const minutes = Math.floor(diff / (1000 * 60))
  const hours = Math.floor(diff / (1000 * 60 * 60))
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  if (minutes < 1) return "刚刚"
  if (minutes < 60) return `${minutes} 分钟前`
  if (hours < 24) return `${hours} 小时前`
  if (days === 1) return "昨天"
  if (days < 7) return `${days} 天前`
  return new Date(timestamp).toLocaleDateString("zh-CN")
}

function getTimeGroup(timestamp: number): "today" | "yesterday" | "earlier" {
  const hours = (Date.now() - timestamp) / (1000 * 60 * 60)
  if (hours < 24) return "today"
  if (hours < 48) return "yesterday"
  return "earlier"
}

const groupLabels = { today: "今天", yesterday: "昨天", earlier: "更早" } as const

// ========== 主组件 ==========
export default function HistoryToolsPage() {
  const navigate = useNavigate()
  const [searchQuery, setSearchQuery] = useState("")
  const [activeFilter, setActiveFilter] = useState<"all" | HistoryItem["type"]>("all")
  const [historyData, setHistoryData] = useState<HistoryItem[]>(mockHistory)

  // 过滤 + 排序
  const filteredHistory = useMemo(() => {
    return historyData
      .filter((item) => {
        if (activeFilter !== "all" && item.type !== activeFilter) return false
        if (searchQuery) {
          const q = searchQuery.toLowerCase()
          return item.name.toLowerCase().includes(q) || item.path.toLowerCase().includes(q)
        }
        return true
      })
      .sort((a, b) => b.lastOpened - a.lastOpened)
  }, [historyData, activeFilter, searchQuery])

  // 按时间分组
  const groupedHistory = useMemo(() => {
    const groups: Record<string, HistoryItem[]> = { today: [], yesterday: [], earlier: [] }
    filteredHistory.forEach((item) => {
      groups[getTimeGroup(item.lastOpened)].push(item)
    })
    return groups
  }, [filteredHistory])

  const handleRemoveItem = (id: string) => {
    setHistoryData((prev) => prev.filter((i) => i.id !== id))
  }

  const handleClearAll = () => {
    if (confirm("确定要清除所有历史记录吗？")) {
      setHistoryData([])
    }
  }

  const handleOpenItem = (item: HistoryItem) => {
    // 实际项目中调用 electronAPI 或 dbAPI
    console.log("打开:", item.path)
  }

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-[#faf9f7]">
      {/* 背景装饰 */}
      <div className="pointer-events-none absolute -top-32 right-0 h-[400px] w-[400px] rounded-full bg-green-100/20 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 -left-20 h-[320px] w-[320px] rounded-full bg-stone-200/20 blur-3xl" />

      <div className="relative z-10 mx-auto max-w-[1280px] px-6 py-10">
        {/* 顶部标题 */}
        <div className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-green-50">
              <Clock className="h-5 w-5 text-green-700" />
            </div>
            <div>
              <h1 className="text-xl font-bold tracking-tight text-stone-900">历史记录 & 工具箱</h1>
              <p className="text-xs text-stone-400">查看最近打开的项目，快速访问开发工具</p>
            </div>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={handleClearAll}
            className="text-stone-400 hover:text-stone-600"
          >
            <Trash2 className="mr-1.5 h-3.5 w-3.5" />
            清除历史
          </Button>
        </div>

        {/* 搜索框 */}
        <div className="relative mb-6">
          <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
          <Input
            type="text"
            placeholder="搜索历史记录..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="h-11 rounded-2xl border-stone-200 bg-white pl-11 pr-10 text-sm placeholder:text-stone-400 focus-visible:ring-green-50 focus-visible:ring-offset-0"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-stone-400 hover:bg-stone-100 hover:text-stone-600"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* 筛选标签 */}
        <div className="mb-8 flex flex-wrap gap-2">
          {filterOptions.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setActiveFilter(opt.value)}
              className={cn(
                "rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors",
                activeFilter === opt.value ? "bg-green-700 text-white" : "border border-stone-200 bg-white text-stone-500 hover:border-stone-300 hover:text-stone-700"
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {/* 主体：左右两栏 */}
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_400px]">
          {/* ========== 左栏：历史记录列表 ========== */}
          <div className="flex flex-col gap-8">
            {filteredHistory.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-stone-200 bg-white/50 py-20">
                <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-stone-100">
                  <Clock className="h-6 w-6 text-stone-400" />
                </div>
                <p className="text-sm font-medium text-stone-600">{searchQuery ? "没有找到匹配的记录" : "暂无历史记录"}</p>
                <p className="mt-1 text-xs text-stone-400">{searchQuery ? "试试其他关键词" : "打开工作区或笔记后会自动记录在这里"}</p>
              </div>
            ) : (
              (["today", "yesterday", "earlier"] as const).map((groupKey) => {
                const items = groupedHistory[groupKey]
                if (items.length === 0) return null
                return (
                  <div key={groupKey}>
                    <div className="mb-3 flex items-center gap-2">
                      <span className="text-xs font-semibold uppercase tracking-wider text-stone-400">{groupLabels[groupKey]}</span>
                      <span className="text-xs text-stone-300">{items.length} 项</span>
                      <div className="ml-2 h-px flex-1 bg-stone-200/60" />
                    </div>
                    <div className="flex flex-col gap-2">
                      {items.map((item) => {
                        const cfg = typeConfig[item.type]
                        const TypeIcon = cfg.icon
                        return (
                          <div
                            key={item.id}
                            onClick={() => handleOpenItem(item)}
                            className="group flex cursor-pointer items-center gap-4 rounded-2xl border border-stone-100 bg-white px-4 py-3.5 transition-all hover:border-stone-200 hover:bg-stone-50/80"
                          >
                            <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", cfg.iconBg)}>
                              <TypeIcon className={cn("h-5 w-5", cfg.iconColor)} />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <h3 className="truncate text-sm font-medium text-stone-800">{item.name}</h3>
                                <Badge
                                  variant="secondary"
                                  className={cn("shrink-0 rounded-md px-1.5 py-0.5 text-[10px] font-medium", cfg.iconBg, cfg.iconColor)}
                                >
                                  {cfg.label}
                                </Badge>
                              </div>
                              <p className="mt-0.5 truncate font-mono text-xs text-stone-400">{item.path}</p>
                            </div>
                            <div className="flex shrink-0 items-center gap-4">
                              {item.fileCount !== undefined && <span className="hidden text-xs text-stone-400 sm:inline">{item.fileCount} 个文件</span>}
                              <span className="flex items-center gap-1 text-xs text-stone-400">
                                <Clock className="h-3 w-3" />
                                {formatRelativeTime(item.lastOpened)}
                              </span>
                              <button
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleRemoveItem(item.id)
                                }}
                                className="rounded-lg p-1.5 text-stone-400 opacity-0 transition-opacity hover:bg-stone-200/60 hover:text-stone-600 group-hover:opacity-100"
                              >
                                <X className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )
              })
            )}
          </div>

          {/* ========== 右栏：工具箱入口展示 ========== */}
          <div className="lg:sticky lg:top-6 lg:self-start">
            <Card className="overflow-hidden rounded-3xl border-stone-200">
              <CardHeader className="flex flex-row items-center justify-between border-b border-stone-100 px-5 py-4">
                <CardTitle className="flex items-center gap-2 text-sm font-semibold text-stone-900">
                  <Wrench className="h-4 w-4 text-green-700" />
                  工具箱
                </CardTitle>
                <span className="text-xs text-stone-400">{tools.length} 个工具</span>
              </CardHeader>
              <CardContent className="grid grid-cols-2 gap-2.5 p-4">
                {tools.map((tool) => {
                  const ToolIcon = tool.icon
                  return (
                    <div
                      key={tool.id}
                      onClick={() => navigate(tool.route)}
                      className="group cursor-pointer rounded-2xl border border-stone-100 bg-white p-3.5 transition-all hover:-translate-y-px hover:border-stone-200 hover:bg-stone-50"
                    >
                      <div className={cn("mb-2.5 flex h-9 w-9 items-center justify-center rounded-lg", tool.iconBg)}>
                        <ToolIcon className={cn("h-4.5 w-4.5", tool.iconColor)} />
                      </div>
                      <div className="mb-0.5 flex items-center justify-between">
                        <span className="text-sm font-medium text-stone-800">{tool.name}</span>
                        <ChevronRight className="h-3.5 w-3.5 -translate-x-1 text-stone-400 opacity-0 transition-all group-hover:translate-x-0 group-hover:opacity-100" />
                      </div>
                      <p className="text-[11px] leading-relaxed text-stone-400">{tool.description}</p>
                    </div>
                  )
                })}
              </CardContent>
              <div className="border-t border-stone-100 px-4 py-3">
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full text-xs font-medium text-stone-500 hover:text-stone-700"
                  onClick={() => navigate("/tools")}
                >
                  查看全部工具
                  <ChevronRight className="ml-1 h-3.5 w-3.5" />
                </Button>
              </div>
            </Card>
          </div>
        </div>

        {/* 底部提示 */}
        <p className="mt-10 text-center text-xs text-stone-300">历史记录仅保存在本地 · 工具箱数据不存储</p>
      </div>
    </div>
  )
}
