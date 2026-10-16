import { type ColumnTypeKey } from "@/pages/todos/components/todo-table-model"
import { Activity, Calendar as CalendarIcon, CheckCircle2, MoreVertical, Tag as TagIcon, Type, User } from "lucide-react"
export const COLUMN_TYPES_META: Record<ColumnTypeKey, { label: string; desc: string; icon: typeof Type }> = {
  text: { label: "文本属性", desc: "普通文字内容", icon: Type },
  person: { label: "人物属性", desc: "负责人 / 成员", icon: User },
  tag: { label: "Tag 属性", desc: "标签 / 分类", icon: TagIcon },
  time: { label: "时间属性", desc: "日期 / 截止时间", icon: CalendarIcon },
  status: { label: "状态属性", desc: "进行中 / 已完成等", icon: CheckCircle2 },
  progress: { label: "进度属性", desc: "百分比进度条", icon: Activity },
  action: { label: "操作属性", desc: "编辑 / 删除按钮", icon: MoreVertical }
}
