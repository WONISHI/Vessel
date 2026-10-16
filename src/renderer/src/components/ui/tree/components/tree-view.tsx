import { File } from "@/components/ui/tree/components/file"
import { Folder } from "@/components/ui/tree/components/folder"
import { Tree } from "@/components/ui/tree/components/tree"
import { TreeViewProps } from "@/components/ui/tree/components/tree-shared"

/** Renders the tree view component. */
export function TreeView({ data, itemClassName, ...props }: TreeViewProps) {
  /** Renders node. */
  const renderNode = (node: any) => {
    if (node.children && node.children.length > 0) {
      return (
        <Folder
          key={node.path}
          name={node.name}
          className={itemClassName}
        >
          {node.children.map(renderNode)}
        </Folder>
      )
    }
    return (
      <File
        key={node.path}
        id={node.path}
        name={node.name}
        className={itemClassName}
      />
    )
  }

  return <Tree {...props}>{data.map(renderNode)}</Tree>
}
