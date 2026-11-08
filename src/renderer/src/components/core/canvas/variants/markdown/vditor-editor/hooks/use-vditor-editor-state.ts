import { type MarkdownInsertLocation } from "@/components/core/canvas/variants/markdown/insert-menu-selection"
import { WorkspaceContext } from "@/components/workspace/types/workspace"
import { useContext } from "react"
import { parseFrontmatter } from "@vessel/obsidian/frontmatter"
import { useRef, useState } from "react"
import Vditor from "vditor"
import type { VditorEditorProps } from "@/components/core/canvas/variants/markdown/vditor-editor/types"

/** 编辑器的 React 状态、引用与属性 */
export function useVditorEditorState({ value, onChange, workspacePath, documentPath, readOnly = false, onReady }: VditorEditorProps) {
  const tableWorkspace = useContext(WorkspaceContext)
  const [footnoteTarget, setFootnoteTarget] = useState<{ range: Range; text: string; path: string } | null>(null)
  const [insertLocation, setInsertLocation] = useState<MarkdownInsertLocation | null>(null)
  const clipboardImageInsertAction = useRef<(() => void) | null>(null)
  const imageInsertAction = useRef<(() => void) | null>(null)
  const [languageBlock, setLanguageBlock] = useState<HTMLElement | null>(null)
  const [codeContextMenu, setCodeContextMenu] = useState<{ block: HTMLElement; x: number; y: number } | null>(null)
  const [colorAnchor, setColorAnchor] = useState<{ left: number; top: number } | null>(null)
  const colorRange = useRef<Range | null>(null)
  const instance = useRef<Vditor | null>(null)
  const [headingBlockMenu, setHeadingBlockMenu] = useState<{ heading: HTMLElement; x: number; y: number } | null>(null)
  const [calloutBlockMenu, setCalloutBlockMenu] = useState<{ quote: HTMLElement; x: number; y: number } | null>(null)
  const [calloutMenu, setCalloutMenu] = useState<{ quote: HTMLElement; x: number; y: number } | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState("")
  const host = useRef<HTMLDivElement>(null)
  const toolbarHost = useRef<HTMLDivElement>(null)
  const [properties] = useState(() => parseFrontmatter(value))
  const latestValue = useRef(value)
  latestValue.current = value
  const initialValue = useRef(properties?.body ?? value)
  const readyHandler = useRef(onReady)
  readyHandler.current = onReady
  const changeHandler = useRef(onChange)

  return { headingBlockMenu, setHeadingBlockMenu, value, onChange, workspacePath, documentPath, readOnly, onReady, tableWorkspace, footnoteTarget, setFootnoteTarget, insertLocation, setInsertLocation, clipboardImageInsertAction, imageInsertAction, languageBlock, setLanguageBlock, codeContextMenu, setCodeContextMenu, colorAnchor, setColorAnchor, colorRange, instance, calloutBlockMenu, setCalloutBlockMenu, calloutMenu, setCalloutMenu, loading, setLoading, loadError, setLoadError, host, toolbarHost, properties, initialValue, latestValue, readyHandler, changeHandler }
}

export type VditorEditorState = ReturnType<typeof useVditorEditorState>
