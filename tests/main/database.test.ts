import { afterEach, beforeEach, describe, it, vi } from "vitest"
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

/**
 * vi.mock 会被提升到文件顶部。
 *
 * 使用 vi.hoisted 创建共享状态，
 * 让 Electron Mock 能够读取每条测试动态生成的 userData 路径。
 */
const electronState = vi.hoisted(() => ({
  userDataPath: ""
}))

/**
 * 模拟 Electron 主进程中的 app 对象。
 *
 * AppDatabase 内部会调用：
 * - app.getPath("userData")：获取数据库保存目录；
 * - app.getLocale()：获取当前语言；
 * - app.getVersion()：获取应用版本；
 * - app.isPackaged：判断是否为生产环境。
 *
 * 测试时将数据库保存到临时目录，
 * 避免修改真实的 Vessel 数据库。
 */
vi.mock("electron", () => ({
  app: {
    /**
     * 返回当前测试使用的临时 userData 路径。
     */
    getPath: vi.fn((name: string) => {
      if (name !== "userData") {
        throw new Error(`测试中不支持 app.getPath(${name})`)
      }

      return electronState.userDataPath
    }),

    /**
     * 模拟 Electron 当前语言。
     */
    getLocale: vi.fn(() => "zh-CN"),

    /**
     * 模拟当前应用版本。
     */
    getVersion: vi.fn(() => "1.0.0-test"),

    /**
     * 表示当前处于开发环境。
     */
    isPackaged: false
  }
}))

import { AppDatabase } from "../../src/main/modules/welcome/database/index.database"
import type { WorkspaceDataInput } from "../../src/main/modules/welcome/index.type"

describe("AppDatabase 数据打印", () => {
  /**
   * 当前测试持有的数据库实例。
   */
  let database: AppDatabase | null = null

  /**
   * 当前测试使用的临时根目录。
   */
  let testRootPath = ""

  /**
   * 当前测试使用的模拟工作区目录。
   */
  let workspacePath = ""

  beforeEach(() => {
    /**
     * 每次测试都创建独立的临时目录。
     *
     * 例如：
     * /tmp/vessel-database-test-xxxxxx
     */
    testRootPath = mkdtempSync(join(tmpdir(), "vessel-database-test-"))

    /**
     * 模拟 Electron 的 userData 目录。
     *
     * 数据库最终会创建在：
     * <临时目录>/user-data/vessel.db
     */
    electronState.userDataPath = join(testRootPath, "user-data")

    /**
     * 创建用于模拟用户选择的工作区目录。
     */
    workspacePath = join(testRootPath, "workspace")

    mkdirSync(workspacePath, {
      recursive: true
    })

    /**
     * 创建数据库实例。
     *
     * AppDatabase 初始化时会：
     * 1. 创建 userData 目录；
     * 2. 创建 vessel.db；
     * 3. 执行数据库迁移；
     * 4. 保存当前设备信息；
     * 5. 创建本次应用会话。
     */
    database = new AppDatabase()
  })

  afterEach(() => {
    /**
     * 必须先关闭 better-sqlite3 数据库连接，
     * 然后才能安全删除临时目录。
     */
    database?.close()
    database = null

    /**
     * 删除测试期间创建的：
     * - vessel.db；
     * - SQLite WAL 文件；
     * - SQLite SHM 文件；
     * - 模拟工作区文件。
     */
    if (testRootPath && existsSync(testRootPath)) {
      rmSync(testRootPath, {
        recursive: true,
        force: true
      })
    }

    testRootPath = ""
    workspacePath = ""
    electronState.userDataPath = ""
  })

  /**
   * 创建一份模拟的工作区数据。
   *
   * 同时会在临时工作区中创建：
   * - README.md；
   * - data.json。
   */
  function createWorkspace(name = "测试工作区"): WorkspaceDataInput {
    const markdownPath = join(workspacePath, "README.md")

    const jsonPath = join(workspacePath, "data.json")

    writeFileSync(markdownPath, "# Vessel Test", "utf8")

    writeFileSync(
      jsonPath,
      JSON.stringify(
        {
          name: "Vessel"
        },
        null,
        2
      ),
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

  /**
   * 打印标题，使不同类型的数据更容易区分。
   */
  function printTitle(title: string): void {
    console.log(`\n========== ${title} ==========`)
  }

  /**
   * 打印单个对象。
   *
   * depth: null 表示完整展开所有嵌套属性。
   */
  function printObject(title: string, value: unknown): void {
    printTitle(title)

    console.dir(value, {
      depth: null,
      colors: true
    })
  }

  /**
   * 打印数组形式的数据。
   *
   * 数组不为空时使用 console.table，
   * 数据为空时直接输出空数组。
   */
  function printTable(title: string, value: unknown[]): void {
    printTitle(title)

    if (value.length === 0) {
      console.log("暂无数据")
      return
    }

    console.table(value)
  }

  it("打印数据库中的所有数据", () => {
    if (!database) {
      throw new Error("数据库尚未初始化")
    }

    /**
     * 一、打印数据库基本信息。
     *
     * 包括：
     * - 数据库文件路径；
     * - 数据库版本；
     * - 当前设备 ID；
     * - 当前会话 ID。
     */
    const databaseInfo = database.getInfo()

    printObject("数据库基本信息", databaseInfo)

    console.log("数据库文件是否存在：", existsSync(databaseInfo.databasePath))

    /**
     * 二、创建模拟工作区。
     */
    const workspace = createWorkspace()

    printObject("准备写入的工作区原始数据", workspace)

    /**
     * 三、第一次打开工作区。
     *
     * 此时：
     * - openCount 应该为 1；
     * - 会创建 workspaces 记录；
     * - 会创建 workspace_open_records 记录。
     */
    const firstOpenedWorkspace = database.recordWorkspaceOpened(workspace)

    printObject("第一次打开工作区的保存结果", firstOpenedWorkspace)

    /**
     * 四、第二次打开同一个工作区。
     *
     * 此时：
     * - workspaces 不会重复新增；
     * - openCount 会增加；
     * - workspace_open_records 会新增一条记录。
     */
    const secondOpenedWorkspace = database.recordWorkspaceOpened(workspace)

    printObject("第二次打开工作区的保存结果", secondOpenedWorkspace)

    /**
     * 五、打印最近打开的工作区。
     */
    const recentWorkspaces = database.getRecentWorkspaces(10)

    console.log("======最近打开的工作区=======", recentWorkspaces)

    /**
     * 六、打印当前工作区的每次打开记录。
     */
    const openRecords = database.getWorkspaceOpenRecords(firstOpenedWorkspace.id, 100)

    // printTable("工作区打开记录", openRecords)
    console.log(openRecords)

    /**
     * 七、打印当前设备信息。
     *
     * 包括：
     * - 主机名；
     * - 操作系统；
     * - CPU；
     * - 内存；
     * - 时区；
     * - Electron 版本；
     * - Node.js 版本；
     * - 应用版本。
     */
    const currentDevice = database.getCurrentDevice()

    printObject("当前设备信息", currentDevice)

    /**
     * 八、写入一些应用状态，
     * 方便查看 app_state 表中的数据。
     */
    database.setState("editor.settings", {
      theme: "dark",
      fontSize: 16,
      lineHeight: 1.6
    })

    database.setState("workspace.current", {
      id: secondOpenedWorkspace.id,
      name: secondOpenedWorkspace.name,
      path: secondOpenedWorkspace.path,
      openedAt: secondOpenedWorkspace.openedAt
    })

    database.setState("welcome.completed", true)

    /**
     * 九、读取并打印指定应用状态。
     */
    const editorSettings = database.getState("editor.settings")

    const currentWorkspace = database.getState("workspace.current")

    const welcomeCompleted = database.getState("welcome.completed")

    printObject("editor.settings 应用状态", editorSettings)

    printObject("workspace.current 应用状态", currentWorkspace)

    printObject("welcome.completed 应用状态", welcomeCompleted)

    /**
     * 十、获取数据库允许被调试接口访问的业务表。
     *
     * SQLite 内部表不会出现在这里。
     */
    const tables = database.getDatabaseTables()

    printTable("数据库业务表", tables)

    /**
     * 十一、遍历所有业务表。
     *
     * 分别打印：
     * - 表结构；
     * - SQLite 原始字段数据；
     * - 转换为中文字段名后的展示数据；
     * - 分页信息。
     */
    for (const table of tables) {
      const schema = database.getDatabaseTableSchema(table.name)

      const tableData = database.getDatabaseTableData(table.name, 1, 100)

      printTable(`${table.label}（${table.name}）表结构`, schema)

      printObject(`${table.label}（${table.name}）分页信息`, {
        tableName: tableData.tableName,
        tableLabel: tableData.tableLabel,
        page: tableData.page,
        pageSize: tableData.pageSize,
        total: tableData.total,
        pageCount: tableData.pageCount
      })

      printTable(`${table.label}（${table.name}）原始数据`, tableData.rows)

      printTable(`${table.label}（${table.name}）中文展示数据`, tableData.displayRows)
    }

    printTitle("数据库数据打印完成")
  })
})
