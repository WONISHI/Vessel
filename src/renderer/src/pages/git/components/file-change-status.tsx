const statuses: Record<string, { label: string; color: string }> = {
  A: { label: "新增", color: "bg-green-50 text-green-600" },
  M: { label: "修改", color: "bg-amber-50 text-amber-600" },
  D: { label: "删除", color: "bg-red-50 text-red-600" },
  R: { label: "重命名", color: "bg-blue-50 text-blue-600" },
  C: { label: "复制", color: "bg-violet-50 text-violet-600" },
  U: { label: "冲突", color: "bg-red-50 text-red-600" },
  "?": { label: "未跟踪（新增）", color: "bg-blue-50 text-blue-600" },
  "!": { label: "已忽略", color: "bg-stone-100 text-stone-500" },
  T: { label: "类型变更", color: "bg-amber-50 text-amber-600" }
}

export function gitChangeStatusTitle(status: string): string {
  return statuses[status.trim()[0]]?.label ?? (status ? `未知状态（${status}）` : "未知状态")
}

export function FileChangeStatus({ status }: { status: string }) {
  const item = statuses[status[0]] || { label: status || "未知", color: "bg-stone-100 text-stone-500" }
  return <span className={`shrink-0 rounded px-1.5 py-0.5 text-[10px] font-medium ${item.color}`}>{item.label}</span>
}
