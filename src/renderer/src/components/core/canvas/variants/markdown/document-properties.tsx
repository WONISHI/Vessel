import type { FrontmatterProperty } from "@vessel/obsidian/frontmatter"
import { Table, TableBody, TableRow, TableCell, TableHead, TableHeader } from "@/components/ui/table"
import { Link } from "@/components/ui/link"
export function DocumentProperties({ properties }: { properties: FrontmatterProperty[] }) {
  return (
    <section
      aria-label="文档属性"
      className="mx-8 mb-2 mt-4 overflow-hidden rounded-lg border"
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
              <TableCell className="whitespace-pre-wrap break-all text-xs">{/^https?:\/\//.test(value) ? <Link href={value}>{value}</Link> : value || <span className="text-stone-400">—</span>}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </section>
  )
}
