import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

/**
 * vi.mock 会被提升到文件顶部，因此测试运行目录需要通过
 * vi.hoisted 创建，确保 Electron Mock 可以访问它。
 */
const electronState = vi.hoisted(() => ({
  userDataPath: ""
}))

/**
 * AppDatabase 依赖 Electron 的 app 对象。
 *
 * 测试时将 userData 指向临时目录，避免读写真实的：
 * ~/Library/Application Support/Vessel/vessel.db
 */
vi.mock("electron", () => ({
  app: {
    getPath: vi.fn((name: string) => {
      if (name !== "userData") {
        throw new Error(`测试中不支持 app.getPath(${name})`)
      }

      return electronState.userDataPath
    }),

    getLocale: vi.fn(() => "zh-CN"),

    getVersion: vi.fn(() => "1.0.0-test"),

    isPackaged: false
  }
}))

import { AppDatabase } from "../../src/main/modules/welcome/index.database"
import type { WorkspaceDataInput } from "../../src/main/modules/welcome/index.type"

describe("AppDatabase", () => {
  let database: AppDatabase | null = null
  let testRootPath = ""
  let workspacePath = ""

  beforeEach(() => {
    /**
     * 每条测试创建独立目录，避免数据库状态相互影响。
     */
    testRootPath = mkdtempSync(join(tmpdir(), "vessel-database-test-"))

    electronState.userDataPath = join(testRootPath, "user-data")

    workspacePath = join(testRootPath, "workspace")

    mkdirSync(workspacePath, {
      recursive: true
    })

    database = new AppDatabase()
  })

  afterEach(() => {
    /**
     * 先关闭 better-sqlite3 连接，
     * 再删除临时测试目录。
     */
    database?.close()
    database = null

    if (testRootPath && existsSync(testRootPath)) {
      rmSync(testRootPath, {
        recursive: true,
        force: true
      })
    }
  })

  /**
   * 创建测试工作区数据。
   */
  function createWorkspace(name = "测试工作区"): WorkspaceDataInput {
    const markdownPath = join(workspacePath, "README.md")

    const jsonPath = join(workspacePath, "data.json")

    writeFileSync(markdownPath, "# Vessel Test", "utf8")

    writeFileSync(
      jsonPath,
      JSON.stringify({
        name: "Vessel"
      }),
      "utf8"
    )

    return {
      name,
      path: workspacePath,
      files: [
        {
          name: "README.md",
          path: markdownPath
        },
        {
          name: "data.json",
          path: jsonPath
        }
      ]
    }
  }

  it("应该在临时 userData 目录创建数据库", () => {
    const info = database!.getInfo()

    expect(info.databasePath).toBe(join(electronState.userDataPath, "vessel.db"))

    expect(existsSync(info.databasePath)).toBe(true)

    expect(info.databaseVersion).toBe(2)
    expect(info.deviceId).toBeTruthy()
    expect(info.sessionId).toBeTruthy()
  })

  it("应该保存工作区并返回完整持久化数据", () => {
    const workspace = createWorkspace()

    const result = database!.recordWorkspaceOpened(workspace)

    expect(result).toMatchObject({
      id: 1,
      name: "测试工作区",
      path: workspacePath,
      openCount: 1
    })

    expect(result.files).toHaveLength(2)
    expect(result.deviceId).toBeTruthy()
    expect(result.sessionId).toBeTruthy()
    expect(result.firstOpenedAt).toBeTruthy()
    expect(result.lastOpenedAt).toBeTruthy()
    expect(result.openedAt).toBeTruthy()
  })

  it("重复打开相同工作区时应该增加打开次数", () => {
    const workspace = createWorkspace()

    const firstResult = database!.recordWorkspaceOpened(workspace)

    const secondResult = database!.recordWorkspaceOpened(workspace)

    expect(firstResult.id).toBe(secondResult.id)

    expect(firstResult.openCount).toBe(1)
    expect(secondResult.openCount).toBe(2)
  })

  it("应该返回最近打开的工作区", () => {
    const workspace = createWorkspace()

    database!.recordWorkspaceOpened(workspace)

    const recentWorkspaces = database!.getRecentWorkspaces(10)

    expect(recentWorkspaces).toHaveLength(1)

    expect(recentWorkspaces[0]).toMatchObject({
      id: 1,
      name: "测试工作区",
      path: workspacePath,
      fileCount: 2,
      openCount: 1,
      isAvailable: true
    })
  })

  it("应该保存每一次工作区打开记录", () => {
    const workspace = createWorkspace()

    const firstResult = database!.recordWorkspaceOpened(workspace)

    database!.recordWorkspaceOpened(workspace)

    const records = database!.getWorkspaceOpenRecords(firstResult.id)

    expect(records).toHaveLength(2)

    expect(records[0]).toMatchObject({
      workspaceId: firstResult.id,
      path: workspacePath,
      fileCount: 2,
      appVersion: "1.0.0-test",
      locale: "zh-CN"
    })

    expect(records[0].hostname).toBeTruthy()
    expect(records[0].cpuModel).toBeTruthy()
    expect(records[0].cpuCount).toBeGreaterThan(0)
    expect(records[0].totalMemory).toBeGreaterThan(0)
    expect(records[0].nodeVersion).toBeTruthy()
  })

  it("应该能够新增、读取、覆盖和删除应用状态", () => {
    expect(database!.getState("editor.settings")).toBeNull()

    database!.setState("editor.settings", {
      theme: "dark",
      fontSize: 16
    })

    expect(
      database!.getState<{
        theme: string
        fontSize: number
      }>("editor.settings")
    ).toEqual({
      theme: "dark",
      fontSize: 16
    })

    database!.setState("editor.settings", {
      theme: "light",
      fontSize: 18
    })

    expect(database!.getState("editor.settings")).toEqual({
      theme: "light",
      fontSize: 18
    })

    expect(database!.deleteState("editor.settings")).toBe(true)

    expect(database!.getState("editor.settings")).toBeNull()

    expect(database!.deleteState("editor.settings")).toBe(false)
  })

  it("不应该允许保存 undefined 状态", () => {
    expect(() => {
      database!.setState("invalid-state", undefined)
    }).toThrow("app_state 不支持保存 undefined")
  })

  it("应该返回当前设备信息", () => {
    const device = database!.getCurrentDevice()

    expect(device.id).toBeTruthy()
    expect(device.hostname).toBeTruthy()
    expect(device.locale).toBe("zh-CN")
    expect(device.appVersion).toBe("1.0.0-test")
    expect(device.nodeVersion).toBeTruthy()
    expect(device.cpuCount).toBeGreaterThan(0)
    expect(device.totalMemory).toBeGreaterThan(0)
  })

  it("应该返回数据库中的所有业务表和中文名称", () => {
    const tables = database!.getDatabaseTables()

    expect(tables).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "workspaces",
          label: "工作区"
        }),
        expect.objectContaining({
          name: "workspace_open_records",
          label: "工作区打开记录"
        }),
        expect.objectContaining({
          name: "devices",
          label: "设备信息"
        }),
        expect.objectContaining({
          name: "app_state",
          label: "应用状态"
        })
      ])
    )

    /**
     * SQLite 内部表不应该暴露给调试接口。
     */
    expect(tables.some((table) => table.name.startsWith("sqlite_"))).toBe(false)
  })

  it("应该返回工作区表结构及中文字段名称", () => {
    const columns = database!.getDatabaseTableSchema("workspaces")

    expect(columns).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          name: "name",
          label: "工作区名称",
          type: "TEXT"
        }),
        expect.objectContaining({
          name: "file_count",
          label: "文件数量",
          type: "INTEGER"
        }),
        expect.objectContaining({
          name: "open_count",
          label: "打开次数",
          type: "INTEGER"
        })
      ])
    )
  })

  it("应该分页返回数据库表数据和中文展示数据", () => {
    const workspace = createWorkspace()

    database!.recordWorkspaceOpened(workspace)

    const result = database!.getDatabaseTableData("workspaces", 1, 20)

    expect(result.tableName).toBe("workspaces")

    expect(result.tableLabel).toBe("工作区")

    expect(result.page).toBe(1)
    expect(result.pageSize).toBe(20)
    expect(result.total).toBe(1)
    expect(result.pageCount).toBe(1)

    /**
     * rows 保留 SQLite 原始英文键名。
     */
    expect(result.rows[0]).toMatchObject({
      name: "测试工作区",
      path: workspacePath,
      file_count: 2,
      open_count: 1
    })

    /**
     * displayRows 使用中文展示名称。
     */
    expect(result.displayRows[0]).toMatchObject({
      工作区名称: "测试工作区",
      工作区路径: workspacePath,
      文件数量: 2,
      打开次数: 1
    })
  })

  it("不应该读取不存在的数据库表", () => {
    expect(() => {
      database!.getDatabaseTableData("not_existing_table")
    }).toThrow("数据库表不存在或不允许访问")
  })

  it("不应该通过表名执行 SQL 注入", () => {
    expect(() => {
      database!.getDatabaseTableData('workspaces"; DROP TABLE workspaces; --')
    }).toThrow("数据库表不存在或不允许访问")

    const tables = database!.getDatabaseTables()

    expect(tables.some((table) => table.name === "workspaces")).toBe(true)
  })
})
