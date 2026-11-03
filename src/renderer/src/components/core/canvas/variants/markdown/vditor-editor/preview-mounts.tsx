import { LinkedTableEditor } from "@/components/core/canvas/variants/markdown-table/linked-editor"
import { WorkspaceContext } from "@/components/workspace/types/workspace"
import { focusImageParagraph, focusImageSourceBoundary } from "@/components/core/canvas/variants/markdown/image-paragraph"
import { prepareObsidianImages, restoreObsidianImages } from "@/components/core/canvas/variants/markdown/image-source"
import { ObsidianImageLine } from "@/components/core/canvas/variants/markdown/obsidian-images"
import { parseFrontmatter } from "@vessel/obsidian/frontmatter"
import { createRoot, type Root } from "react-dom/client"
import { toast } from "sonner"
import Vditor from "vditor"
import type { ContextType } from "react"

/** Vditor 预览块挂载所需的依赖（通过 getter 读取延迟赋值的编辑器实例） */
export type PreviewMountDeps = {
  tableRoots: Map<HTMLElement, Root>
  imageRoots: Map<HTMLElement, Root>
  workspacePath: string
  documentPath: string
  tableWorkspace: ContextType<typeof WorkspaceContext>
  readOnly: boolean
  changeHandler: { current: (value: string) => void }
  properties: ReturnType<typeof parseFrontmatter>
  getEditor: () => Vditor
  mountImage: (preview: HTMLElement) => void
}

/** 创建表格代码块挂载函数 */
export function createTableMounter({ tableRoots, workspacePath, tableWorkspace, readOnly, changeHandler, properties, getEditor }: PreviewMountDeps) {
  return (previewElement: HTMLElement) => {
      const block = previewElement.closest<HTMLElement>("[data-type=code-block]")
      if (!block) return
      block.classList.add("vessel-table-block")
      block.classList.remove("vessel-direct-code")

      if (previewElement.querySelector(".vessel-table-container")) return

      const code = previewElement.querySelector("code") || block.querySelector("pre.vditor-ir__marker code")
      const source = code?.textContent || ""

      const container = document.createElement("div")
      container.className = "vessel-table-container"
      container.contentEditable = "false"
      container.addEventListener("mousedown", (event) => event.stopPropagation())
      container.addEventListener("click", (event) => event.stopPropagation())
      container.addEventListener("mouseup", (event) => event.stopPropagation())
      previewElement.replaceChildren(container)

      for (const [node, root] of tableRoots) {
        if (!node.isConnected) {
          queueMicrotask(() => root.unmount())
          tableRoots.delete(node)
        }
      }

      const root = createRoot(container)
      tableRoots.set(container, root)

      const renderTable = (currentSource: string) =>
        root.render(
          <LinkedTableEditor
            root={workspacePath}
            onOpenFile={tableWorkspace?.openWorkspaceFile}
            readOnly={readOnly}
            source={currentSource}
            onChange={(updated) => {
              if (readOnly) return
              const sourceCode = block.querySelector("pre.vditor-ir__marker code")
              if (!sourceCode) return
              getEditor()?.vditor?.undo?.addToUndoStack(getEditor().vditor)
              sourceCode.textContent = updated + "\n"
              const next = getEditor()?.getValue() || ""
              renderTable(updated)
              getEditor()?.vditor?.undo?.addToUndoStack(getEditor().vditor)
              changeHandler.current((properties?.raw ?? "") + restoreObsidianImages(next))
            }}
            onFocusAbove={() => {
              const editable = block.closest<HTMLElement>('[contenteditable="true"]')
              if (!editable || readOnly) return
              focusImageParagraph(block, false)?.scrollIntoView({ block: "nearest" })
            }}
            onFocusBelow={() => {
              const editable = block.closest<HTMLElement>('[contenteditable="true"]')
              if (!editable || readOnly) return
              focusImageParagraph(block)?.scrollIntoView({ block: "nearest" })
            }}
            onCopy={() => {
              const sourceCode = block.querySelector("pre.vditor-ir__marker code")
              const textToCopy = sourceCode?.textContent?.trim() || currentSource || ""
              if (textToCopy) {
                void navigator.clipboard?.writeText(textToCopy)
                toast.success("已复制表格数据")
              }
            }}
            onDelete={() => {
              if (readOnly) return
              getEditor()?.vditor?.undo?.addToUndoStack(getEditor().vditor)
              block.remove()
              const next = getEditor()?.getValue() || ""
              getEditor()?.vditor?.undo?.addToUndoStack(getEditor().vditor)
              changeHandler.current((properties?.raw ?? "") + restoreObsidianImages(next))
              tableRoots.delete(container)
              queueMicrotask(() => root.unmount())
            }}
          />
        )
      renderTable(source)
  }
}

/** Mount newly inserted image previews without rebuilding the Markdown editor. */
export function createImageMounter({ imageRoots, workspacePath, documentPath, readOnly, changeHandler, properties, getEditor, mountImage }: PreviewMountDeps) {
  return (element: HTMLElement) => {
      const code = element.closest('[data-type="code-block"]')?.querySelector("pre.vditor-ir__marker code.language-vessel-obsidian-image") || element.querySelector("code.language-vessel-obsidian-image")
      if (!code) return
      let source: string
      try {
        source = decodeURIComponent(code.textContent?.trim() || "")
      } catch {
        return
      }
      element.closest("[data-type=code-block]")?.classList.add("vessel-image-block")
      const mounted = element.querySelector<HTMLElement>(".vessel-image-component")
      if (mounted?.dataset.imageSource === source) return
      const container = document.createElement("div")
      container.className = "vessel-image-component"
      container.contentEditable = "false"
      container.addEventListener("mousedown", (event) => {
        event.stopPropagation()
        if ((event.target as HTMLElement).closest("img")) event.preventDefault()
      })
      container.addEventListener("click", (event) => event.stopPropagation())
      container.addEventListener("mouseup", (event) => event.stopPropagation())
      element.replaceChildren(container)
      for (const [node, root] of imageRoots) {
        if (!node.isConnected) {
          queueMicrotask(() => root.unmount())
          imageRoots.delete(node)
        }
      }
      const root = createRoot(container)
      imageRoots.set(container, root)
      /** Updates only this React image root, retaining the surrounding getEditor() DOM. */
      const renderImage = (currentSource: string) => {
        container.dataset.imageSource = currentSource
        const focusAt = (offset: number) => {
          const block = element.closest<HTMLElement>('[data-type="code-block"]')
          const sourceCode = block?.querySelector("pre.vditor-ir__marker code")
          if (!block || !sourceCode || readOnly) return
          getEditor().vditor.undo?.addToUndoStack(getEditor().vditor)
          // Nested-in-quote: sibling empty <p> (or split) stays inside the callout; top-level stays beside the image block.
          const paragraph = focusImageSourceBoundary(block, currentSource, offset, (source) => getEditor().vditor.lute.Md2VditorIRDOM(prepareObsidianImages(source)))
          if (!paragraph) return
          if (!block.isConnected) {
            for (const neighbor of [paragraph.previousElementSibling, paragraph.nextElementSibling]) {
              const preview = neighbor?.querySelector<HTMLElement>(".vditor-ir__preview")
              if (preview) mountImage(preview)
            }
          }
          getEditor().vditor.undo?.addToUndoStack(getEditor().vditor)
          changeHandler.current((properties?.raw ?? "") + restoreObsidianImages(getEditor().getValue()))
          paragraph.scrollIntoView({ block: "nearest" })
        }
        root.render(
          <ObsidianImageLine
            onFocusAbove={(offset) => focusAt(offset)}
            onFocusBelow={(offset) => focusAt(offset)}
            readOnly={readOnly}
            source={currentSource}
            onChange={(updated) => {
              if (readOnly) return
              const block = element.closest<HTMLElement>("[data-type=code-block]")
              const sourceCode = block?.querySelector("pre.vditor-ir__marker code")
              if (!sourceCode) return
              getEditor().vditor.undo?.addToUndoStack(getEditor().vditor)
              if (!updated.trim()) {
                block?.remove()
                const next = getEditor().getValue()
                getEditor().vditor.undo?.addToUndoStack(getEditor().vditor)
                changeHandler.current((properties?.raw ?? "") + restoreObsidianImages(next))
                imageRoots.delete(container)
                queueMicrotask(() => root.unmount())
                return
              }
              sourceCode.textContent = encodeURIComponent(updated) + "\n"
              const next = getEditor().getValue()
              renderImage(updated)
              getEditor().vditor.undo?.addToUndoStack(getEditor().vditor)
              changeHandler.current((properties?.raw ?? "") + restoreObsidianImages(next))
            }}
            root={workspacePath}
            documentPath={documentPath}
          />
        )
      }
      renderImage(source)
  }
}
