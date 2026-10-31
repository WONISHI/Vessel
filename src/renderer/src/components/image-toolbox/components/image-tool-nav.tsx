import { groups } from "@/components/image-toolbox/components/image-toolbox-shared"
import { ScrollArea } from "@/components/ui/scroll-area"
import type { ImageToolboxModel } from "@/components/image-toolbox/hooks/use-image-toolbox"

/** 左侧工具导航 */
export function ImageToolNav({ m }: { m: ImageToolboxModel }) {
  const { tool, setTool } = m

  return (
          <ScrollArea className="image-tool-nav">
            <nav aria-label="图片操作">
              {groups.map((group) => (
                <section key={group.label}>
                  <h3>{group.label}</h3>
                  {group.tools.map(({ id, title, icon: ToolIcon }) => (
                    <button
                      key={id}
                      aria-pressed={tool === id}
                      onClick={() => setTool(id)}
                    >
                      <ToolIcon />
                      {title}
                    </button>
                  ))}
                </section>
              ))}
            </nav>
          </ScrollArea>
  )
}
