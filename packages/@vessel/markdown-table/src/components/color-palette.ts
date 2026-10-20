export interface ColorOption {
  label: string
  value: string
  border?: string
}

export const BG_COLORS: ColorOption[] = [
  { label: "无背景", value: "", border: "#d1d5db" },
  { label: "浅灰", value: "#f3f4f6" },
  { label: "淡红", value: "#fee2e2" },
  { label: "淡橙", value: "#ffedd5" },
  { label: "淡黄", value: "#fef3c7" },
  { label: "淡绿", value: "#dcfce7" },
  { label: "淡蓝", value: "#dbeafe" },
  { label: "淡紫", value: "#f3e8ff" },
  { label: "青翠", value: "#ccfbf1" },
  { label: "粉红", value: "#fce7f3" },
  { label: "暗灰", value: "#374151" },
  { label: "暗蓝", value: "#1e3a8a" }
]

export const TEXT_COLORS: ColorOption[] = [
  { label: "默认", value: "" },
  { label: "黑色", value: "#111827" },
  { label: "灰色", value: "#6b7280" },
  { label: "红色", value: "#dc2626" },
  { label: "橙色", value: "#ea580c" },
  { label: "黄色", value: "#ca8a04" },
  { label: "绿色", value: "#16a34a" },
  { label: "蓝色", value: "#2563eb" },
  { label: "紫色", value: "#9333ea" },
  { label: "青色", value: "#0d9488" },
  { label: "粉色", value: "#db2777" },
  { label: "白色", value: "#ffffff" }
]
