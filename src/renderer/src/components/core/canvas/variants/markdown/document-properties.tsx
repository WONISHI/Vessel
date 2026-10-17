import { ObsidianPropertyValue } from "@/components/obsidian-property-value"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import type { FrontmatterProperty } from "@vessel/obsidian/frontmatter"

/** Renders the document properties component. */
export function DocumentProperties({ properties, workspacePath }: { properties: FrontmatterProperty[]; workspacePath: string }) {
  return (
    <section
      aria-label="文档属性"
      className="document-properties mx-8 mb-2 mt-4 overflow-hidden rounded-lg border"
    >
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-40">属性</TableHead>
            <TableHead>内容</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {properties.map(({ key, value }, index) => (
            <TableRow key={index}>
              <TableCell className="align-top text-xs font-medium">{key}</TableCell>
              <TableCell className="whitespace-pre-wrap break-all text-xs">
                {value ? (
                  <ObsidianPropertyValue
                    text={value}
                    root={workspacePath}
                  />
                ) : (
                  <span className="text-stone-400">—</span>
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </section>
  )
}
