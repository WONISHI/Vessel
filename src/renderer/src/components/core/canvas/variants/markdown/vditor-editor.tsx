import { bindWikiLinkEditing, decorateWikiLinks } from "./decorate-wiki-links"
import { decorateInlineHTML } from "./inline-html"
import { decorateCodeBlocks } from "./code-blocks"
import { parseFrontmatter } from "@vessel/obsidian/frontmatter"
import { DocumentProperties } from "./document-properties"
import { PageLoading } from "@/components/ui/page-loading"
import { Breadcrumb, BreadcrumbList, BreadcrumbItem, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb"
import { createRoot, type Root } from "react-dom/client"
import { ObsidianImageLine } from "./obsidian-images"
import { prepareObsidianImages, restoreObsidianImages } from "./image-source"
import { decorateMarkdownTags } from "./decorate-tags"
import { LinkInteractionArea } from "@/components/ui/link"
import { Fragment, useEffect, useRef, useState } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { ImagePlus, Smile, Minus, Heading, Bold, Italic, Strikethrough, Link, List, ListOrdered, ListChecks, Quote, Code, CodeXml, Table2, Undo2, Redo2 } from "lucide-react"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Typography } from "@/components/ui/typography"
import Vditor from "vditor"
import "vditor/dist/index.css"

/** 保留 Vditor 编辑能力，文档显示和大纲由外层 React 组件负责。 */
export function VditorEditor({ value, onChange, workspacePath, documentPath, readOnly = false }: { readOnly?: boolean; workspacePath: string; documentPath: string; value: string; onChange: (value: string) => void }) {
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState("")
  const host = useRef<HTMLDivElement>(null)
  const toolbarHost = useRef<HTMLDivElement>(null)
  const [properties] = useState(() => parseFrontmatter(value))
  const initialValue = useRef(properties?.body ?? value)
  const changeHandler = useRef(onChange)
  useEffect(() => {
    changeHandler.current = onChange
  }, [onChange])
  useEffect(() => {
    if (!host.current) return
    const element = host.current
    const unbindWikiEditing = bindWikiLinkEditing(element)
    const decorate = () => {
      decorateCodeBlocks(element)
      const content = element.querySelector<HTMLElement>(".vditor-ir .vditor-reset")
      if (content) {
        decorateWikiLinks(content)
        if (readOnly || !content.contains(document.activeElement)) { decorateInlineHTML(content); decorateMarkdownTags(content) }
        if (readOnly) content.querySelectorAll<HTMLInputElement>("input").forEach(input => { input.disabled = true })
      }
    }
    element.addEventListener("focusout", decorate)
    const observer = new MutationObserver(decorate)
    observer.observe(element, { childList: true, subtree: true })
    const imageRoots = new Map<HTMLElement, Root>()
    let disposed = false
    let ready = false
    const imagePicker = document.createElement("input")
    imagePicker.type = "file"
    imagePicker.accept = "image/png,image/jpeg,image/gif,image/webp"
    imagePicker.addEventListener("change", () => {
      const file = imagePicker.files?.[0]
      if (!file || !/^image\/(png|jpeg|gif|webp)$/.test(file.type)) return
      const reader = new FileReader()
      reader.onload = () => {
        if (!disposed && typeof reader.result === "string") {
          editor.insertValue(`![图片](${reader.result})`, true)
        }
      }
      reader.readAsDataURL(file)
      imagePicker.value = ""
    })
    let editor: Vditor
    let initFrame = 0
    let paintFrame = 0
    const timeout = setTimeout(() => {
      if (!disposed && !ready) setLoadError("编辑器加载超时，请重新打开文档。")
    }, 45000)
    const initialize = () => {
      if (disposed) return
      try {
        editor = new Vditor(element, {
          cdn: new URL("./vendor/vditor", document.baseURI).href,
          lang: "zh_CN",
          theme: "classic",
          preview: { hljs: { style: "atom-one-light" }, math: { engine: "KaTeX" } },
          icon: "ant",
          height: "auto",
          value: prepareObsidianImages(initialValue.current),
          customRenders: [
            {
              language: "vessel-obsidian-image",
              render: (element) => {
                const code = element.querySelector("code.language-vessel-obsidian-image")
                if (!code) return
                let source: string
                try {
                  source = decodeURIComponent(code.textContent?.trim() || "")
                } catch {
                  return
                }
                element.closest("[data-type=code-block]")?.classList.add("vessel-image-block")
                const container = document.createElement("div")
                container.contentEditable = "false"
                container.addEventListener("mousedown", event => {
                  event.stopPropagation()
                  if ((event.target as HTMLElement).closest("img")) event.preventDefault()
                })
                container.addEventListener("click", event => event.stopPropagation())
                container.addEventListener("mouseup", event => event.stopPropagation())
                element.replaceChildren(container)
                for (const [node, root] of imageRoots) {
                  if (!node.isConnected) {
                    queueMicrotask(() => root.unmount())
                    imageRoots.delete(node)
                  }
                }
                const root = createRoot(container)
                imageRoots.set(container, root)
                root.render(
                  <ObsidianImageLine
                    readOnly={readOnly}
                    source={source}
                    onChange={(updated) => {
                      if (readOnly) return
                      const sourceCode = element.closest("[data-type=code-block]")?.querySelector("pre.vditor-ir__marker code")
                      if (!sourceCode) return
                      sourceCode.textContent = encodeURIComponent(updated) + "\n"
                      const next = editor.getValue()
                      editor.setValue(next)
                      changeHandler.current((properties?.raw ?? "") + restoreObsidianImages(next))
                    }}
                    root={workspacePath}
                    documentPath={documentPath}
                  />
                )
              }
            }
          ],
          cache: { enable: false },
          outline: { enable: false, position: "right" },
          typewriterMode: false,
          mode: "ir",
          toolbarConfig: { pin: true },
          // 内联 SVG 避免 hash 路由下的 sprite 引用和异步图标脚本加载问题。
          toolbar: readOnly ? [] : [
            { name: "headings", icon: renderToStaticMarkup(<Heading />) },
            { name: "bold", icon: renderToStaticMarkup(<Bold />) },
            { name: "italic", icon: renderToStaticMarkup(<Italic />) },
            { name: "strike", icon: renderToStaticMarkup(<Strikethrough />) },
            "|",
            { name: "link", icon: renderToStaticMarkup(<Link />) },
            { name: "insert-image", tip: "插入图片", icon: renderToStaticMarkup(<ImagePlus />), click: () => imagePicker.click() },
            { name: "emoji", icon: renderToStaticMarkup(<Smile />) },
            { name: "list", icon: renderToStaticMarkup(<List />) },
            { name: "ordered-list", icon: renderToStaticMarkup(<ListOrdered />) },
            { name: "check", icon: renderToStaticMarkup(<ListChecks />) },
            "|",
            { name: "quote", icon: renderToStaticMarkup(<Quote />) },
            { name: "code", icon: renderToStaticMarkup(<Code />) },
            { name: "inline-code", icon: renderToStaticMarkup(<CodeXml />) },
            { name: "table", icon: renderToStaticMarkup(<Table2 />) },
            { name: "line", icon: renderToStaticMarkup(<Minus />) },
            "|",
            { name: "undo", icon: renderToStaticMarkup(<Undo2 />) },
            { name: "redo", icon: renderToStaticMarkup(<Redo2 />) }
          ].map((item) => (typeof item === "string" ? item : { ...item, tipPosition: "s" })),
          input: (content) => {
            if (!disposed && !readOnly) changeHandler.current((properties?.raw ?? "") + restoreObsidianImages(content))
          },
          after: () => {
            const toolbar = host.current?.querySelector<HTMLElement>(".vditor-toolbar")
            if (!disposed && toolbar && toolbarHost.current) toolbarHost.current.appendChild(toolbar)
            if (readOnly && !disposed) editor.disabled()
            decorate()
            ready = true
            clearTimeout(timeout)
            if (disposed) editor.destroy()
            else
              paintFrame = requestAnimationFrame(() => {
                if (!disposed) {
                  setLoading(false)
                  setLoadError("")
                }
              })
          }
        })
      } catch (error) {
        clearTimeout(timeout)
        if (!disposed) setLoadError(String(error))
      }
    }
    // 先绘制占位图，再开始同步解析，避免首帧白屏。
    initFrame = requestAnimationFrame(() => {
      initFrame = requestAnimationFrame(initialize)
    })
    return () => {
      clearTimeout(timeout)
      cancelAnimationFrame(initFrame)
      cancelAnimationFrame(paintFrame)
      imageRoots.forEach((root) => queueMicrotask(() => root.unmount()))
      observer.disconnect()
      unbindWikiEditing()
      element.removeEventListener("focusout", decorate)
      disposed = true
      if (ready) editor.destroy()
      toolbarHost.current?.replaceChildren()
    }
  }, [properties, readOnly])
  return (
    <LinkInteractionArea className="relative flex h-full min-h-0 min-w-0 flex-col">
      {(loading || loadError) && (
        <div className="absolute inset-0 z-30 bg-white">
          {loadError ? (
            <p
              role="alert"
              className="p-6 text-sm text-red-600"
            >
              {loadError}
            </p>
          ) : (
            <PageLoading label="正在解析 Markdown 文档…" />
          )}
        </div>
      )}
      {!readOnly && <Breadcrumb
        className="shrink-0 px-4 pt-2"
        aria-label="当前文件路径"
      >
        <BreadcrumbList className="text-xs">
          {[workspacePath.split(/[\\/]/).filter(Boolean).pop() || "工作区", ...documentPath.slice(workspacePath.length).split(/[\\/]/).filter(Boolean)].map((part, index, parts) => (
            <Fragment key={index}>
              {index > 0 && <BreadcrumbSeparator />}
              <BreadcrumbItem className="min-w-0">
                {index === parts.length - 1 ? (
                  <BreadcrumbPage
                    className="truncate max-w-64"
                    title={part}
                  >
                    {part}
                  </BreadcrumbPage>
                ) : (
                  <span>{part}</span>
                )}
              </BreadcrumbItem>
            </Fragment>
          ))}
        </BreadcrumbList>
      </Breadcrumb>}
      <div
        ref={toolbarHost}
        className={readOnly ? "hidden" : "vessel-vditor shrink-0 min-w-0 w-full"}
      />
      <ScrollArea className="vessel-editor-scroll flex-1 min-h-0 min-w-0 mt-2">
        {properties && <DocumentProperties properties={properties.properties} />}
        <Typography asChild>
          <div
            ref={host}
            className="vessel-vditor min-h-full"
          />
        </Typography>
      </ScrollArea>
    </LinkInteractionArea>
  )
}
