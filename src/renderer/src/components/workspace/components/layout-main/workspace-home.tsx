import { useDarkAppearance } from "@/hooks/use-dark-appearance"
import vesselLogo from "@/assets/vessel.png"
import { VditorEditor } from "@/components/core/canvas/variants/markdown/vditor-editor"
import { Button } from "@/components/ui/button"
import { Carousel, CarouselContent, CarouselItem, type CarouselApi } from "@/components/ui/carousel"
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { useWorkspace } from "@/components/workspace/hooks/useWorkspace"
import { useWorkspaceActivity } from "@/components/workspace/hooks/useWorkspaceActivity"
import { cn } from "@/lib/utils"
import Autoplay from "embla-carousel-autoplay"
import { Activity, BookOpen, Calendar, Code, ExternalLink, File, FileCode, FileCode2, FileText, FolderOpen, Image as ImageIcon, Layers, LayoutTemplate, TrendingUp } from "lucide-react"
import { useEffect, useRef, useState } from "react"
import { ActivityCalendar } from "react-activity-calendar"
import { CartesianGrid, Line, LineChart, Tooltip as RechartsTooltip, ResponsiveContainer, XAxis, YAxis } from "recharts"

/** Returns file meta. */
function getFileMeta(fileName: string) {
  const ext = fileName.split(".").pop()?.toLowerCase() || ""
  if (["md", "markdown"].includes(ext)) {
    return {
      ext,
      icon: FileText,
      badgeClass: "text-emerald-600 bg-emerald-50/90 border-emerald-200/60"
    }
  }
  if (["ts", "tsx", "js", "jsx", "mjs", "cjs"].includes(ext)) {
    return {
      ext,
      icon: Code,
      badgeClass: "text-blue-600 bg-blue-50/90 border-blue-200/60"
    }
  }
  if (["json", "yaml", "yml", "xml", "toml"].includes(ext)) {
    return {
      ext,
      icon: FileCode2,
      badgeClass: "text-amber-600 bg-amber-50/90 border-amber-200/60"
    }
  }
  if (["css", "scss", "less"].includes(ext)) {
    return {
      ext,
      icon: FileCode,
      badgeClass: "text-cyan-600 bg-cyan-50/90 border-cyan-200/60"
    }
  }
  if (["canvas", "excalidraw"].includes(ext)) {
    return {
      ext,
      icon: LayoutTemplate,
      badgeClass: "text-purple-600 bg-purple-50/90 border-purple-200/60"
    }
  }
  if (["png", "jpg", "jpeg", "gif", "webp", "svg"].includes(ext)) {
    return {
      ext,
      icon: ImageIcon,
      badgeClass: "text-pink-600 bg-pink-50/90 border-pink-200/60"
    }
  }
  if (["base", "db", "sqlite"].includes(ext)) {
    return {
      ext,
      icon: Layers,
      badgeClass: "text-indigo-600 bg-indigo-50/90 border-indigo-200/60"
    }
  }
  return {
    ext: ext || "file",
    icon: File,
    badgeClass: "text-stone-600 bg-stone-100 border-stone-200"
  }
}

/** Renders the workspace home component. */
export default function WorkspaceHome() {
  const dark = useDarkAppearance()
  const { workspace, openFiles, openWorkspaceFile, activeFilePath } = useWorkspace()
  const { calendarData, activityMap, monthlyData } = useWorkspaceActivity(workspace.path)

  const [carouselApi, setCarouselApi] = useState<CarouselApi>()
  const [currentSlide, setCurrentSlide] = useState(0)

  // Autoplay 1 minute
  const autoplayPlugin = useRef(
    Autoplay({
      delay: 60000,
      stopOnInteraction: false
    })
  )

  useEffect(() => {
    if (!carouselApi) return

    /** Handles select events. */
    const onSelect = () => {
      setCurrentSlide(carouselApi.selectedScrollSnap())
    }
    carouselApi.on("select", onSelect)
    return () => {
      carouselApi.off("select", onSelect)
    }
  }, [carouselApi])

  // Read README.md in workspace root
  const [readme, setReadme] = useState<{ path: string; content: string } | null>(null)
  const [readmeLoading, setReadmeLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setReadmeLoading(true)

    /** Finds readme. */
    const findReadme = async () => {
      try {
        const entries = await window.electronAPI.readWorkspaceDirectory(workspace.path, workspace.path)
        if (cancelled) return
        const entry = entries.find((item) => item.type === "file" && item.name.toLowerCase() === "readme.md")
        if (entry) {
          let content = await window.electronAPI.readContent(entry.path)
          // 替换相对 logo 路径，避免只读渲染时图片破损
          content = content.replace(/\.\/src\/renderer\/src\/assets\/vessel\.png/g, vesselLogo)
          if (!cancelled) setReadme({ path: entry.path, content })
        } else {
          if (!cancelled) setReadme(null)
        }
      } catch {
        if (!cancelled) setReadme(null)
      } finally {
        if (!cancelled) setReadmeLoading(false)
      }
    }
    void findReadme()
    return () => {
      cancelled = true
    }
  }, [workspace.path])

  return (
    <ScrollArea className="h-full w-full">
      <div className="mx-auto w-full max-w-5xl space-y-6 p-8 pb-16">
        {/* Workspace Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3.5">
            <span className="flex size-12 items-center justify-center rounded-2xl border border-emerald-100 bg-emerald-50 text-emerald-700 shadow-sm">
              <FolderOpen className="size-6" />
            </span>
            <div>
              <h1 className="workspace-home-title text-xl font-bold tracking-tight text-stone-900">{workspace.name}</h1>
              <p className="mt-0.5 break-all text-xs text-stone-400">{workspace.path}</p>
            </div>
          </div>
        </div>

        {/* 1. 当前打开的文件（全新卡片样式） */}
        <section className="workspace-open-files rounded-xl border border-stone-200/70 dark:border-[#444c56] bg-white p-5 shadow-sm">
          <div className="mb-3.5 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileText className="size-4 text-emerald-600" />
              <h2 className="text-sm font-semibold text-stone-800">当前打开的文件</h2>
              <span className="workspace-open-count rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">{openFiles.length}</span>
            </div>
          </div>

          {openFiles.length ? (
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
              {openFiles.map((file) => {
                const meta = getFileMeta(file.name)
                const Icon = meta.icon
                const relativePath = file.path.replace(workspace.path, "").replace(/^[\\/]/, "") || file.name

                return (
                  <div
                    key={file.path}
                    data-active={file.path === activeFilePath}
                    role="button"
                    tabIndex={0}
                    onClick={() => openWorkspaceFile(file)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault()
                        openWorkspaceFile(file)
                      }
                    }}
                    className="workspace-file-card group relative flex min-w-0 cursor-pointer flex-col justify-between rounded-lg border border-stone-200/80 bg-stone-50/40 p-3 text-left transition-all hover:-translate-y-0.5 hover:border-emerald-300 hover:bg-emerald-50/30 hover:shadow-sm"
                  >
                    <div className="mb-2 flex items-center justify-between">
                      <span className={cn("workspace-file-icon flex size-7 items-center justify-center rounded-md border", meta.badgeClass)}>
                        <Icon className="size-4" />
                      </span>
                      <span className="workspace-file-type font-mono text-[10px] uppercase text-stone-400 transition-colors group-hover:text-emerald-600">{meta.ext}</span>
                    </div>
                    <div>
                      <p
                        className="workspace-file-name truncate text-xs font-medium text-stone-700 transition-colors group-hover:text-emerald-800"
                        data-title={file.name}
                      >
                        {file.name}
                      </p>
                      <p
                        className="workspace-file-path mt-0.5 truncate text-[11px] text-stone-400"
                        data-title={file.path}
                      >
                        {relativePath}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-stone-200 py-7 text-center">
              <File className="mb-1.5 size-7 text-stone-300" />
              <p className="text-xs font-medium text-stone-600">暂无打开的文件</p>
              <p className="mt-0.5 text-[11px] text-stone-400">从左侧目录树选择文件，即可在标签页中快速打开</p>
            </div>
          )}
        </section>

        {/* 2. 轮播图：热力图（年）与 折线图（月），1分钟自动轮播 */}
        <section className="rounded-xl border border-stone-200/70 dark:border-[#444c56] bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between border-b border-stone-100 pb-3">
            <div className="flex items-center gap-2">
              <Activity className="size-4 text-emerald-600" />
              <h2 className="text-sm font-semibold text-stone-800">工作区编辑动态</h2>
            </div>
            <div
              data-workspace-activity-switch
              className="flex items-center gap-1.5 rounded-lg border border-stone-200/70 bg-stone-50/80 p-0.5 text-xs"
            >
              <button
                type="button"
                aria-pressed={currentSlide === 0}
                onClick={() => carouselApi?.scrollTo(0)}
                className={cn("flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition-all", currentSlide === 0 ? "bg-white text-emerald-700 shadow-sm" : "text-stone-500 hover:text-stone-800")}
              >
                <Calendar className="size-3.5" />
                年度热力图
              </button>
              <button
                type="button"
                aria-pressed={currentSlide === 1}
                onClick={() => carouselApi?.scrollTo(1)}
                className={cn("flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-medium transition-all", currentSlide === 1 ? "bg-white text-emerald-700 shadow-sm" : "text-stone-500 hover:text-stone-800")}
              >
                <TrendingUp className="size-3.5" />
                近30天趋势
              </button>
            </div>
          </div>

          <Carousel
            setApi={setCarouselApi}
            plugins={[autoplayPlugin.current]}
            opts={{
              loop: true
            }}
            className="w-full"
          >
            <CarouselContent>
              {/* Slide 1: react-activity-calendar 热力图（自适应容器单屏展示，无横向滚动条） */}
              <CarouselItem>
                <div className="workspace-activity-calendar flex w-full flex-col items-center justify-center px-1 py-1">
                  <div className="w-full">
                    <TooltipProvider delayDuration={50}>
                      <ActivityCalendar
                        data={calendarData}
                        colorScheme={dark ? "dark" : "light"}
                        theme={{
                          light: ["#ebedf0", "#9be9a8", "#40c463", "#30a14e", "#216e39"],
                          dark: ["#444c56", "#065f46", "#047857", "#059669", "#10b981"]
                        }}
                        labels={{
                          months: ["1月", "2月", "3月", "4月", "5月", "6月", "7月", "8月", "9月", "10月", "11月", "12月"],
                          weekdays: ["日", "一", "二", "三", "四", "五", "六"],
                          legend: { less: "较少", more: "较多" },
                          totalCount: "过去一年累计 {{count}} 次文件编辑"
                        }}
                        renderBlock={(block, activity) => {
                          const act = activityMap.get(activity.date)
                          const hasActivity = act && (act.create > 0 || act.update > 0 || act.delete > 0)
                          return (
                            <Tooltip
                              key={activity.date}
                              delayDuration={50}
                            >
                              <TooltipTrigger asChild>{block}</TooltipTrigger>
                              <TooltipContent
                                side="top"
                                sideOffset={6}
                                className="z-[100] rounded-lg border border-stone-200/90 bg-white/95 px-3 py-2 text-xs text-stone-800 shadow-lg backdrop-blur-sm animate-in fade-in-0 zoom-in-95"
                              >
                                <p className="font-semibold text-stone-900">{activity.date}</p>
                                {hasActivity ? (
                                  <div className="mt-1 flex items-center gap-2 text-[11px] text-stone-600">
                                    <span className="flex items-center gap-0.5 font-medium text-emerald-600">改 {act.update}</span>
                                    <span className="text-stone-300">·</span>
                                    <span className="flex items-center gap-0.5 font-medium text-blue-600">增 {act.create}</span>
                                    <span className="text-stone-300">·</span>
                                    <span className="flex items-center gap-0.5 font-medium text-rose-600">删 {act.delete}</span>
                                  </div>
                                ) : (
                                  <p className="mt-0.5 text-[11px] text-stone-400">无编辑动态</p>
                                )}
                              </TooltipContent>
                            </Tooltip>
                          )
                        }}
                        blockSize={11}
                        blockMargin={2.5}
                        blockRadius={2}
                        fontSize={11}
                      />
                    </TooltipProvider>
                  </div>
                </div>
              </CarouselItem>

              {/* Slide 2: 折线图（近一个月编辑情况：修改、创建、删除） */}
              <CarouselItem>
                <div className="flex flex-col py-1">
                  <div className="mb-2 flex items-center justify-between px-2 text-xs">
                    <span className="text-[11px] text-stone-400">近 30 天变更统计</span>
                    <div className="flex items-center gap-3 text-xs">
                      <span className="flex items-center gap-1 text-emerald-600 font-medium">
                        <span className="size-2 rounded-full bg-emerald-500" />
                        修改
                      </span>
                      <span className="flex items-center gap-1 text-blue-600 font-medium">
                        <span className="size-2 rounded-full bg-blue-500" />
                        新建
                      </span>
                      <span className="flex items-center gap-1 text-rose-600 font-medium">
                        <span className="size-2 rounded-full bg-rose-500" />
                        删除
                      </span>
                    </div>
                  </div>
                  <div className="h-[180px] w-full">
                    <ResponsiveContainer
                      width="100%"
                      height="100%"
                    >
                      <LineChart
                        data={monthlyData}
                        margin={{ top: 8, right: 16, left: -20, bottom: 0 }}
                      >
                        <CartesianGrid
                          strokeDasharray="3 3"
                          vertical={false}
                          stroke="#f0efed"
                        />
                        <XAxis
                          dataKey="date"
                          tickLine={false}
                          axisLine={false}
                          tickMargin={6}
                          stroke="#a8a29e"
                          fontSize={10}
                        />
                        <YAxis
                          tickLine={false}
                          axisLine={false}
                          tickMargin={6}
                          allowDecimals={false}
                          stroke="#a8a29e"
                          fontSize={10}
                        />
                        <RechartsTooltip
                          content={({ active, payload }) => {
                            if (!active || !payload?.length) return null
                            const data = payload[0].payload as (typeof monthlyData)[0]
                            return (
                              <div className="rounded-lg border border-stone-200/80 bg-white p-2.5 text-xs shadow-md">
                                <p className="mb-1 font-semibold text-stone-700">{data.fullDate}</p>
                                <div className="space-y-0.5 text-[11px]">
                                  <p className="text-emerald-600">修改: {data.修改}</p>
                                  <p className="text-blue-600">新建: {data.新建}</p>
                                  <p className="text-rose-600">删除: {data.删除}</p>
                                  <p className="border-t border-stone-100 pt-0.5 text-stone-500 font-medium">总计: {data.总计}</p>
                                </div>
                              </div>
                            )
                          }}
                        />
                        <Line
                          type="monotone"
                          dataKey="修改"
                          stroke="#10b981"
                          strokeWidth={2}
                          dot={false}
                          activeDot={{ r: 4 }}
                        />
                        <Line
                          type="monotone"
                          dataKey="新建"
                          stroke="#3b82f6"
                          strokeWidth={2}
                          dot={false}
                          activeDot={{ r: 4 }}
                        />
                        <Line
                          type="monotone"
                          dataKey="删除"
                          stroke="#f43f5e"
                          strokeWidth={2}
                          dot={false}
                          activeDot={{ r: 4 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </CarouselItem>
            </CarouselContent>
          </Carousel>

          {/* Carousel indicator dots */}
          <div className="mt-3 flex justify-center gap-1.5">
            <button
              type="button"
              aria-label="查看热力图"
              aria-pressed={currentSlide === 0}
                onClick={() => carouselApi?.scrollTo(0)}
              className={cn("h-1.5 rounded-full transition-all", currentSlide === 0 ? "w-5 bg-emerald-600" : "w-1.5 bg-stone-200 hover:bg-stone-300")}
            />
            <button
              type="button"
              aria-label="查看趋势图"
              aria-pressed={currentSlide === 1}
                onClick={() => carouselApi?.scrollTo(1)}
              className={cn("h-1.5 rounded-full transition-all", currentSlide === 1 ? "w-5 bg-emerald-600" : "w-1.5 bg-stone-200 hover:bg-stone-300")}
            />
          </div>
        </section>

        {/* 3. 轮播图下面：项目情况（README.md，使用 vditor 显示只读） */}
        <section className="rounded-xl border border-stone-200/70 dark:border-[#444c56] bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between border-b border-stone-100 pb-3">
            <div className="flex items-center gap-2">
              <BookOpen className="size-4 text-emerald-600" />
              <h2 className="text-sm font-semibold text-stone-800">项目情况 (README.md)</h2>
            </div>
            {readme && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs text-stone-500 hover:text-emerald-700"
                onClick={() => openWorkspaceFile({ name: "README.md", path: readme.path })}
              >
                <ExternalLink className="mr-1 size-3.5" />
                在编辑器中打开
              </Button>
            )}
          </div>

          {readmeLoading ? (
            <div className="flex h-36 items-center justify-center text-xs text-stone-400">正在加载项目 README.md 文档…</div>
          ) : readme ? (
            <div className="rounded-lg border border-stone-200/80 dark:border-[#444c56] bg-white shadow-xs">
              <ScrollArea className="h-[480px] w-full p-4">
                <div className="workspace-readme-body [&_.vditor]:!border-none [&_.vditor]:!bg-transparent [&_.vditor-reset]:!opacity-100 [&_.vditor-reset]:!cursor-text [&_.vditor-reset]:!text-stone-800 [&_.vditor-reset_h1]:!text-stone-900 [&_.vditor-reset_h1]:!font-bold [&_.vditor-reset_h2]:!text-stone-900 [&_.vditor-reset_h2]:!font-bold [&_.vditor-reset_h3]:!text-stone-900 [&_.vditor-reset_p]:!text-stone-800 [&_.vditor-reset_li]:!text-stone-800 [&_.vditor-reset_strong]:!text-stone-900 [&_.vditor-toolbar]:!hidden">
                  <VditorEditor
                    value={readme.content}
                    workspacePath={workspace.path}
                    documentPath={readme.path}
                    readOnly={true}
                    onChange={() => {}}
                  />
                </div>
                <ScrollBar orientation="vertical" />
              </ScrollArea>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center rounded-lg border border-dashed border-stone-200 py-10 text-center">
              <BookOpen className="mb-2 size-8 text-stone-300" />
              <p className="text-xs font-medium text-stone-600">当前工作区根目录下未找到 README.md</p>
              <p className="mt-1 text-[11px] text-stone-400">在项目根目录下新建 README.md 后，将在此处以只读模式实时展示项目说明</p>
            </div>
          )}
        </section>
      </div>
      <ScrollBar orientation="vertical" />
    </ScrollArea>
  )
}
