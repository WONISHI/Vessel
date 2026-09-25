import { useForm, useWatch } from "react-hook-form"
import { Form, FormField, FormItem, FormControl, FormMessage } from "@/components/ui/form"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select"
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationPrevious, PaginationNext, PaginationEllipsis } from "@/components/ui/pagination"
import { cn } from "@/lib/utils"

export interface PaginationState {
  /** 从 1 开始的页码。 */
  page: number
  /** 每页记录数，须为正整数，与服务端分页限制保持一致。 */
  pageSize: number
}
export interface DataTablePaginationProps extends PaginationState {
  /** 当前查询匹配的记录总数；未筛选时为整表记录数。 */
  total: number
  /** 实际显示的行数，加载或出错时为 0。 */
  visibleRowCount: number
  /** 是否正在加载，默认 false；加载时禁用所有分页操作。 */
  loading?: boolean
  /** 是否处于筛选状态，默认 false；控制统计文字中的“匹配记录”。 */
  filtered?: boolean
  /** 可选每页条数，默认 [10, 20, 50, 100, 200]，需符合服务端限制。 */
  pageSizeOptions?: readonly number[]
  /** 是否显示每页条数选择器，默认 true。 */
  showPageSize?: boolean
  /** 是否显示页码跳转表单，默认 true。 */
  showPageJump?: boolean
  /** 页码与每页条数一起更新，避免产生中间请求。 */
  onPaginationChange: (state: PaginationState) => void
}
/** 生成分页页码序列：1 2 3 ... 125 */
function getPageItems(current: number, total: number): (number | "...")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1)
  const items: (number | "...")[] = [1]
  const left = Math.max(2, current - 1)
  const right = Math.min(total - 1, current + 1)
  if (left > 2) items.push("...")
  for (let i = left; i <= right; i++) items.push(i)
  if (right < total - 1) items.push("...")
  items.push(total)
  return items
}

export function DataTablePagination({ page, pageSize, total, visibleRowCount, loading = false, filtered = false, pageSizeOptions = [10, 20, 50, 100, 200], showPageSize = true, showPageJump = true, onPaginationChange }: DataTablePaginationProps) {
  const form = useForm<{ jumpPage: string }>({ defaultValues: { jumpPage: "" } })
  const jumpPage = useWatch({ control: form.control, name: "jumpPage" })
  const totalPages = Math.max(1, Math.ceil(total / pageSize))
  const pageItems = getPageItems(page, totalPages)
  const rangeStart = visibleRowCount ? (page - 1) * pageSize + 1 : 0
  const rangeEnd = visibleRowCount ? Math.min(total, rangeStart + visibleRowCount - 1) : 0
  const changePage = (next: number) => {
    if (!loading) {
      onPaginationChange({ page: Math.max(1, Math.min(totalPages, next)), pageSize })
      form.reset()
    }
  }
  return (
    <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-[#f0efed] px-5 py-3">
      <span className="text-[11px] text-stone-500">
        显示 {rangeStart}-{rangeEnd} 条，共 {total.toLocaleString()} 条{filtered ? "匹配记录" : ""}
      </span>
      <div className="flex flex-wrap items-center gap-2">
        {showPageSize && (
          <div className="flex items-center gap-1 text-[11px] text-stone-500">
            <span>每页</span>
            <Select
              value={String(pageSize)}
              disabled={loading}
              onValueChange={(value) => {
                onPaginationChange({ page: 1, pageSize: Number(value) })
                form.reset()
              }}
            >
              <SelectTrigger
                aria-label="每页条数"
                className="h-8 w-[88px] rounded-lg border-stone-200 bg-white px-2 text-[11px] focus:ring-green-500 focus:ring-offset-0"
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-lg border-stone-200 bg-white">
                {pageSizeOptions.map((size) => (
                  <SelectItem
                    key={size}
                    value={String(size)}
                    className="text-[11px] focus:bg-green-50 focus:text-green-700"
                  >
                    {size} 条
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}
        <Pagination className="mx-0 w-auto">
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                href="#"
                aria-disabled={loading || page === 1}
                tabIndex={loading || page === 1 ? -1 : 0}
                className="h-8 w-8 rounded-lg border border-stone-200 bg-white text-stone-600 hover:bg-[#faf9f7] aria-disabled:pointer-events-none aria-disabled:opacity-50"
                onClick={(event) => {
                  event.preventDefault()
                  if (!loading && page > 1) changePage(page - 1)
                }}
              />
            </PaginationItem>
            {pageItems.map((item, index) => (
              <PaginationItem key={item === "..." ? `ellipsis-${index}` : item}>
                {item === "..." ? (
                  <PaginationEllipsis className="h-8 w-6 text-stone-400" />
                ) : (
                  <PaginationLink
                    href="#"
                    isActive={item === page}
                    aria-label={`第 ${item} 页`}
                    aria-disabled={loading}
                    tabIndex={loading ? -1 : 0}
                    onClick={(event) => {
                      event.preventDefault()
                      if (!loading) changePage(item)
                    }}
                    className={cn(
                      "h-8 min-w-8 w-auto rounded-lg border px-2 text-[11px] aria-disabled:pointer-events-none aria-disabled:opacity-50",
                      item === page ? "border-green-600 bg-green-600 font-semibold text-white hover:bg-green-700 hover:text-white" : "border-stone-200 bg-white text-stone-600 hover:text-stone-600 hover:bg-[#faf9f7]"
                    )}
                  >
                    {item}
                  </PaginationLink>
                )}
              </PaginationItem>
            ))}
            <PaginationItem>
              <PaginationNext
                href="#"
                aria-disabled={loading || page === totalPages}
                tabIndex={loading || page === totalPages ? -1 : 0}
                className="h-8 w-8 rounded-lg border border-stone-200 bg-white text-stone-600 hover:bg-[#faf9f7] aria-disabled:pointer-events-none aria-disabled:opacity-50"
                onClick={(event) => {
                  event.preventDefault()
                  if (!loading && page < totalPages) changePage(page + 1)
                }}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
        {showPageJump && (
          <Form {...form}>
            <form
              className="flex items-center gap-1 text-[11px] text-stone-500"
              onSubmit={form.handleSubmit(({ jumpPage }) => {
                if (loading) return
                changePage(Number(jumpPage))
              })}
            >
              <span>跳至</span>
              <FormField
                control={form.control}
                name="jumpPage"
                rules={{
                  required: "请输入页码",
                  validate: (value) => {
                    const target = Number(value)
                    return (Number.isInteger(target) && target >= 1 && target <= totalPages) || `请输入 1–${totalPages} 的整数页码`
                  }
                }}
                render={({ field }) => (
                  <FormItem className="relative space-y-0">
                    <FormControl>
                      <Input
                        {...field}
                        aria-label="跳转页码"
                        type="number"
                        min={1}
                        max={totalPages}
                        step={1}
                        placeholder={String(page)}
                        disabled={loading}
                        className="h-8 w-14 rounded-lg border border-stone-200 px-2 text-[11px] md:text-[11px] focus-visible:border-green-500 focus-visible:ring-1 focus-visible:ring-green-500 focus-visible:ring-offset-0"
                      />
                    </FormControl>
                    <FormMessage className="absolute right-0 top-full z-20 mt-1 whitespace-nowrap rounded bg-white p-1 text-[11px] shadow-sm" />
                  </FormItem>
                )}
              />
              <span>页 / {totalPages} 页</span>
              <Button
                variant="outline"
                type="submit"
                disabled={loading || !jumpPage}
                className="h-8 rounded-lg border border-stone-200 px-2 disabled:opacity-50"
              >
                跳转
              </Button>
            </form>
          </Form>
        )}
      </div>
    </div>
  )
}
