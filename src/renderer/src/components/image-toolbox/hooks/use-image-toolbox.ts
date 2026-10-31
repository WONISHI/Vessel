import { useImageToolboxState } from "@/components/image-toolbox/hooks/use-image-toolbox-state"
import { useImageToolboxActions } from "@/components/image-toolbox/hooks/use-image-toolbox-actions"
import type { ImageToolboxProps } from "@/components/image-toolbox/types"

/** 汇总图片工具箱所需的全部状态与操作 */
export function useImageToolbox(props: ImageToolboxProps) {
  const state = useImageToolboxState(props)
  const actions = useImageToolboxActions(state, props)
  return { ...state, ...actions }
}

export type ImageToolboxModel = ReturnType<typeof useImageToolbox>
