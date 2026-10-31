/** VditorEditor 组件属性 */
export type VditorEditorProps = { onReady?: () => void; readOnly?: boolean; workspacePath: string; documentPath: string; value: string; onChange: (value: string) => void }

import type { VditorEditorState } from "@/components/core/canvas/variants/markdown/vditor-editor/hooks/use-vditor-editor-state"
import type { LinkTooltipState } from "@/components/core/canvas/variants/markdown/vditor-editor/hooks/use-link-tooltip"

/** 浮层子组件共享的编辑器模型 */
export type VditorEditorModel = VditorEditorState & LinkTooltipState
