/**
 * 当前数据库结构版本。
 * 后续调整表结构时递增该值，并在 migrate 中增加对应的迁移步骤。
 */
export const DATABASE_VERSION = 2

/** DevTools 中使用的数据库表中文名称，不影响真实 SQLite 表名。 */
export const DATABASE_TABLE_LABELS: Record<string, string> = {
  app_metadata: "应用元数据",
  devices: "设备信息",
  app_sessions: "应用会话",
  workspaces: "工作区",
  workspace_open_records: "工作区打开记录",
  app_state: "应用状态"
}

/** DevTools 中使用的字段中文名称，不影响真实 SQLite 字段名。 */
export const DATABASE_COLUMN_LABELS: Record<string, Record<string, string>> = {
  app_metadata: {
    key: "键",
    value: "值",
    updated_at: "更新时间"
  },
  devices: {
    id: "设备ID",
    hostname: "主机名",
    platform: "系统平台",
    arch: "系统架构",
    os_type: "操作系统类型",
    os_release: "操作系统发行版本",
    os_version: "操作系统版本",
    cpu_model: "CPU型号",
    cpu_count: "CPU核心数",
    total_memory: "总内存（字节）",
    locale: "语言区域",
    timezone: "时区",
    app_version: "应用版本",
    electron_version: "Electron版本",
    node_version: "Node.js版本",
    first_seen_at: "首次识别时间",
    last_seen_at: "最后识别时间"
  },
  app_sessions: {
    id: "会话ID",
    device_id: "设备ID",
    started_at: "启动时间",
    ended_at: "结束时间",
    app_version: "应用版本",
    electron_version: "Electron版本",
    node_version: "Node.js版本",
    platform: "系统平台",
    arch: "系统架构"
  },
  workspaces: {
    id: "工作区ID",
    name: "工作区名称",
    path: "工作区路径",
    normalized_path: "规范化路径",
    file_count: "文件数量",
    first_opened_at: "首次打开时间",
    last_opened_at: "最后打开时间",
    open_count: "打开次数",
    is_available: "路径是否可用",
    last_device_id: "最后打开设备ID",
    created_at: "创建时间",
    updated_at: "更新时间"
  },
  workspace_open_records: {
    id: "打开记录ID",
    workspace_id: "工作区ID",
    device_id: "设备ID",
    session_id: "会话ID",
    path: "工作区路径",
    file_count: "文件数量",
    opened_at: "打开时间",
    hostname: "主机名",
    os_type: "操作系统类型",
    os_release: "操作系统发行版本",
    os_version: "操作系统版本",
    cpu_model: "CPU型号",
    cpu_count: "CPU核心数",
    total_memory: "总内存（字节）",
    locale: "语言区域",
    timezone: "时区",
    app_version: "应用版本",
    electron_version: "Electron版本",
    node_version: "Node.js版本",
    platform: "系统平台",
    arch: "系统架构"
  },
  app_state: {
    key: "状态键",
    value_json: "状态值",
    device_id: "设备ID",
    created_at: "创建时间",
    updated_at: "更新时间"
  }
}

/** 欢迎页支持扫描的文件扩展名。 */
export const SUPPORTED_EXTENSIONS = new Set([".md", ".json", ".js", ".ts", ".jsx", ".tsx", ".css", ".scss", ".less", ".html", ".vue", ".png", ".jpg", ".jpeg", ".bmp", ".gif", ".webp"])