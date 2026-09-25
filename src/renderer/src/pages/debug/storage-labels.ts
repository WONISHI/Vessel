/** 数据库浏览器的展示名称；数据库表名和字段名保持不变。 */
const tables: Record<string, [string, string]> = {
  app_metadata: ["应用元数据", "保存设备标识等应用内部基础信息。"],
  devices: ["设备信息", "记录设备硬件、操作系统及应用运行环境。"],
  app_sessions: ["应用运行会话", "每次启动应用生成一条记录，保存启动和结束时间。"],
  workspaces: ["工作区", "汇总已打开的工作区、文件数量及打开次数。"],
  workspace_open_records: ["工作区打开记录", "记录每次打开工作区的时间、关联会话及设备环境快照。"],
  app_state: ["应用状态", "以 JSON 保存主题、布局、编辑器设置等应用状态。"]
}

const fields: Record<string, [string, string]> = {
  id: ["记录编号", "当前记录的唯一标识。"],
  key: ["配置键", "用于查找配置的唯一名称。"],
  value: ["配置值", "配置键对应的内容。"],
  value_json: ["状态内容", "以 JSON 格式保存的应用状态。"],
  name: ["工作区名称", "工作区的显示名称。"],
  path: ["目录路径", "工作区在本机上的目录路径。"],
  normalized_path: ["规范化路径", "经过规范化处理的目录路径，用于唯一识别工作区。"],
  device_id: ["关联设备", "对应设备信息表中的设备编号。"],
  last_device_id: ["最近打开设备", "最后一次打开工作区的设备编号。"],
  workspace_id: ["关联工作区", "对应工作区表中的工作区编号。"],
  session_id: ["关联运行会话", "对应应用运行会话表中的会话编号。"],
  file_count: ["文件数量", "记录时工作区的文件数量。"],
  open_count: ["累计打开次数", "该工作区被打开的累计次数。"],
  is_available: ["是否可用", "工作区是否被标记为可用，true 表示可用。"],
  hostname: ["设备名称", "操作系统报告的主机名称。"],
  platform: ["运行平台", "操作系统平台标识，例如 darwin、win32、linux。"],
  arch: ["处理器架构", "处理器架构，例如 arm64、x64。"],
  os_type: ["系统类型", "操作系统类型，例如 Darwin、Windows_NT、Linux。"],
  os_release: ["系统内核版本", "操作系统报告的内核发行版本。"],
  os_version: ["系统版本详情", "操作系统的详细版本描述。"],
  cpu_model: ["处理器型号", "CPU 的型号名称。"],
  cpu_count: ["逻辑处理器数", "操作系统可见的逻辑 CPU 数量。"],
  total_memory: ["物理内存总量", "设备物理内存总容量，单位为字节。"],
  locale: ["语言地区", "应用使用的语言和地区，例如 zh-CN。"],
  timezone: ["时区", "设备所在时区，例如 Asia/Shanghai。"],
  app_version: ["应用版本", "记录时 Vessel 的版本号。"],
  electron_version: ["Electron 版本", "记录时 Electron 桌面运行环境的版本。"],
  node_version: ["Node.js 版本", "记录时 Node.js 运行环境的版本。"],
  first_seen_at: ["首次识别时间", "首次记录该设备的时间。"],
  last_seen_at: ["最近识别时间", "最近更新该设备信息的时间。"],
  started_at: ["启动时间", "本次应用运行会话的开始时间。"],
  ended_at: ["结束时间", "本次会话的结束时间；为空表示尚未记录结束。"],
  first_opened_at: ["首次打开时间", "第一次打开该工作区的时间。"],
  last_opened_at: ["最近打开时间", "最近一次打开该工作区的时间。"],
  opened_at: ["打开时间", "本次打开工作区的时间。"],
  created_at: ["创建时间", "记录创建的时间。"],
  updated_at: ["更新时间", "记录最后更新的时间。"]
}

const primaryLabels: Record<string, string> = {
  devices: "设备编号",
  app_sessions: "运行会话编号",
  workspaces: "工作区编号",
  workspace_open_records: "打开记录编号"
}

export function getTableLabel(name: string): string {
  return tables[name]?.[0] ?? name
}

export function getTableDescription(name: string): string {
  return tables[name]?.[1] ?? "本地 SQLite 数据表。"
}

export function getFieldLabel(table: string, name: string): string {
  if (name === "id") return primaryLabels[table] ?? fields.id[0]
  return fields[name]?.[0] ?? name
}

export function getFieldDescription(table: string, name: string): string {
  if (name === "id") return `${getFieldLabel(table, name)}，用于唯一识别该记录。`
  const description = fields[name]?.[1] ?? "暂无字段说明。"
  return table === "workspace_open_records" && /^(hostname|platform|arch|os_|cpu_|total_memory|locale|timezone|.*_version)/.test(name) ? `打开工作区时的设备环境快照：${description}` : description
}
