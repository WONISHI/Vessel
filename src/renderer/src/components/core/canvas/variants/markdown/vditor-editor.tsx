import { createRoot, type Root } from "react-dom/client"
import { ObsidianImageLine, prepareObsidianImages, restoreObsidianImages } from "./obsidian-images"
import { decorateMarkdownTags } from "./decorate-tags"
import { LinkInteractionArea } from "@/components/ui/link"
import { useEffect, useRef } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { ImagePlus, Smile, Minus, Heading, Bold, Italic, Strikethrough, Link, List, ListOrdered, ListChecks, Quote, Code, CodeXml, Table2, Undo2, Redo2 } from "lucide-react"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Typography } from "@/components/ui/typography"
import Vditor from "vditor"
import "vditor/dist/index.css"

/** 保留 Vditor 编辑能力，文档显示和大纲由外层 React 组件负责。 */
export function VditorEditor({ value, onChange, workspacePath, documentPath }: { workspacePath: string; documentPath: string; value: string; onChange: (value: string) => void }) {
  const host = useRef<HTMLDivElement>(null)
  const initialValue = useRef(value)
  const changeHandler = useRef(onChange)
  useEffect(() => {
    changeHandler.current = onChange
  }, [onChange])
  useEffect(() => {
    if (!host.current) return
    const element = host.current
    const decorate = () => {
      const content = element.querySelector<HTMLElement>(".vditor-ir .vditor-reset")
      if (content && !content.contains(document.activeElement)) decorateMarkdownTags(content)
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
    const editor = new Vditor(host.current, {
      cdn: new URL("./vendor/vditor", document.baseURI).href,
      lang: "zh_CN",
      theme: "classic",
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
            const container = document.createElement("div")
            container.contentEditable = "false"
            element.replaceChildren(container)
            for (const [node, root] of imageRoots) {
              if (!node.isConnected) {
                root.unmount()
                imageRoots.delete(node)
              }
            }
            const root = createRoot(container)
            imageRoots.set(container, root)
            root.render(
              <ObsidianImageLine
                source={source}
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
      toolbar: [
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
        if (!disposed) changeHandler.current(restoreObsidianImages(content))
      },
      after: () => {
        ready = true
        if (disposed) editor.destroy()
      }
    })
    return () => {
      imageRoots.forEach((root) => root.unmount())
      observer.disconnect()
      element.removeEventListener("focusout", decorate)
      disposed = true
      if (ready) editor.destroy()
    }
  }, [])
  return (
    <LinkInteractionArea className="h-full min-h-0">
      <ScrollArea className="vessel-editor-scroll h-full min-h-0 min-w-0">
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
