import type { WorkspaceDataInput } from "../index.type"

/**
 * 判断渲染进程传入的数据是否符合工作区结构。
 *
 * IPC 参数来自渲染进程，运行时不能只依赖 TypeScript 类型，
 * 因此在写入数据库前需要再次验证关键字段。
 */
export function isWorkspaceData(value: unknown): value is WorkspaceDataInput {
  // null、数组以及其他非对象值都不是有效工作区。
  if (!value || typeof value !== "object") return false

  const workspace = value as Partial<WorkspaceDataInput>

  return (
    // 工作区名称不能为空。
    typeof workspace.name === "string" &&
    workspace.name.length > 0 &&
    // 工作区路径不能为空。
    typeof workspace.path === "string" &&
    workspace.path.length > 0 &&
    // 文件列表必须是数组，并且每个文件都必须包含名称和路径。
    Array.isArray(workspace.files) &&
    workspace.files.every((file) => file && typeof file === "object" && typeof file.name === "string" && typeof file.path === "string")
  )
}

/**
 * 校验通用状态的 key。
 *
 * 使用 asserts 后，调用该函数成功返回时，TypeScript 会将 value
 * 收窄为 string，后续可以安全传递给数据库方法。
 */
export function assertStateKey(value: unknown): asserts value is string {
  if (typeof value !== "string" || value.trim().length === 0 || value.length > 200) {
    throw new TypeError("状态 key 必须是长度为 1 到 200 的字符串")
  }
}
