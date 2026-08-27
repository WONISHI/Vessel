import { BrowserWindow, dialog, ipcMain } from "electron"
import { readdir } from "fs/promises"
import { basename, extname, join } from "path"
import { BaseModule } from "../base"
import { AppDatabase } from "./index.database"
import type { WorkspaceDataInput, WorkspaceFile } from "./index.type"
import { isWorkspaceData, assertStateKey } from "./index.util"

/** 欢迎页支持扫描的文件扩展名。 */
const SUPPORTED_EXTENSIONS = new Set([".md", ".json", ".js", ".ts", ".jsx", ".tsx", ".css", ".scss", ".less", ".html", ".vue", ".png", ".jpg", ".jpeg", ".bmp", ".gif", ".webp"])

/**
 * 欢迎页主进程模块。
 *
 * 负责创建欢迎页使用的数据库连接，并集中注册以下 IPC：
 * - 选择并扫描工作区文件夹；
 * - 工作区打开与历史查询；
 * - 当前设备信息查询；
 * - 通用应用状态的增删改查；
 * - 数据库路径及当前会话信息查询。
 *
 * 模块的激活和销毁由 BaseModule 与 apps/index.ts 统一管理。
 */
export class WelcomeModule extends BaseModule {
  /** 当前模块持有的数据库实例，模块未激活或已销毁时为 null。 */
  private database: AppDatabase | null = null

  /**
   * 保存本模块成功注册的 IPC channel。
   * 销毁模块或初始化失败时，根据该列表统一移除 Handler。
   */
  private readonly registeredChannels: string[] = []

  /**
   * 激活欢迎页模块。
   *
   * BaseModule 会保证该方法不会被重复执行。
   * 数据库创建和 IPC 注册放在同一个 try 中，任一步失败都会清理已注册内容。
   */
  protected onActivate(): void {
    const database = new AppDatabase()

    try {
      /**
       * 打开系统文件夹选择窗口，并扫描文件夹内受支持的文件。
       *
       * preload 中的 dialog:openDirectory 会调用这里；
       * 此处只负责选择和扫描，不负责写入数据库。
       */
      this.registerHandler("dialog:openDirectory", async (event) => {
        const parentWindow = BrowserWindow.fromWebContents(event.sender)

        const options: Electron.OpenDialogOptions = {
          title: "选择工作区",
          buttonLabel: "选择文件夹",
          properties: ["openDirectory", "createDirectory"]
        }

        // 优先绑定当前 Electron 窗口，使目录选择弹窗成为主窗口的模态弹窗。
        const result = parentWindow ? await dialog.showOpenDialog(parentWindow, options) : await dialog.showOpenDialog(options)

        // 用户主动取消选择时返回 null，不继续扫描和写入数据库。
        if (result.canceled || result.filePaths.length === 0) {
          return null
        }

        const workspacePath = result.filePaths[0]
        const files = await this.scanWorkspaceFiles(workspacePath)

        const workspace: WorkspaceDataInput = {
          name: basename(workspacePath),
          path: workspacePath,
          files
        }

        return workspace
      })

      /**
       * 记录一次工作区打开操作。
       * preload 会先调用目录选择 IPC，获得工作区数据后再调用这里完成持久化。
       */
      this.registerHandler("workspace:recordOpened", (_event, workspace: unknown) => {
        if (!isWorkspaceData(workspace)) {
          throw new TypeError("工作区数据格式不正确")
        }

        return database.recordWorkspaceOpened(workspace)
      })

      /** 查询最近打开的工作区，默认返回 10 条。 */
      this.registerHandler("workspace:listRecent", (_event, limit?: number) => {
        return database.getRecentWorkspaces(typeof limit === "number" ? limit : 10)
      })

      /** 查询指定工作区的每次打开明细，默认返回 100 条。 */
      this.registerHandler("workspace:listOpenRecords", (_event, workspaceId: unknown, limit?: number) => {
        // workspaceId 对应 workspaces 表的自增主键，只接受正整数。
        if (typeof workspaceId !== "number" || !Number.isInteger(workspaceId) || workspaceId <= 0) {
          throw new TypeError("workspaceId 必须是正整数")
        }

        return database.getWorkspaceOpenRecords(workspaceId, typeof limit === "number" ? limit : 100)
      })

      /** 获取当前设备、系统以及应用版本信息。 */
      this.registerHandler("device:getCurrent", () => database.getCurrentDevice())

      /** 根据 key 读取一项通用 JSON 状态；不存在时返回 null。 */
      this.registerHandler("app-state:get", (_event, key: unknown) => {
        assertStateKey(key)
        return database.getState(key)
      })

      /** 新增或覆盖一项通用 JSON 状态。 */
      this.registerHandler("app-state:set", (_event, key: unknown, value: unknown) => {
        assertStateKey(key)
        database.setState(key, value)
      })

      /** 删除指定 key 的通用状态，并返回是否实际删除成功。 */
      this.registerHandler("app-state:delete", (_event, key: unknown) => {
        assertStateKey(key)
        return database.deleteState(key)
      })

      /** 获取数据库路径、数据库版本、设备 ID 和本次应用会话 ID。 */
      this.registerHandler("storage:getInfo", () => database.getInfo())

      // 所有初始化步骤成功后再保存实例，表示模块已经准备完毕。
      this.database = database
    } catch (error) {
      // 初始化中途失败时，回滚已经注册的 IPC，避免留下部分可用的模块状态。
      this.removeHandlers()
      database.close()
      throw error
    }
  }

  /**
   * 递归扫描工作区中的受支持文件。
   *
   * 只进入普通文件夹，不跟随符号链接，避免循环目录导致无限递归。
   */
  private async scanWorkspaceFiles(directoryPath: string): Promise<WorkspaceFile[]> {
    const files: WorkspaceFile[] = []
    const entries = await readdir(directoryPath, {
      withFileTypes: true
    })

    for (const entry of entries) {
      const entryPath = join(directoryPath, entry.name)

      if (entry.isDirectory()) {
        const children = await this.scanWorkspaceFiles(entryPath)
        files.push(...children)
        continue
      }

      if (!entry.isFile()) {
        continue
      }

      const extension = extname(entry.name).toLowerCase()

      if (!SUPPORTED_EXTENSIONS.has(extension)) {
        continue
      }

      files.push({
        name: entry.name,
        path: entryPath
      })
    }

    return files
  }

  /**
   * 销毁欢迎页模块。
   * 先注销 IPC，阻止新的数据库调用，再关闭当前数据库连接。
   */
  protected onDispose(): void {
    this.removeHandlers()
    this.database?.close()
    this.database = null
  }

  /**
   * 注册 IPC Handler，并记录 channel。
   * 所有 Handler 必须通过该方法注册，才能在销毁时被完整清理。
   */
  private registerHandler(channel: string, listener: Parameters<typeof ipcMain.handle>[1]): void {
    ipcMain.handle(channel, listener)
    this.registeredChannels.push(channel)
  }

  /**
   * 逆序移除本模块注册的全部 IPC Handler。
   * splice(0) 会同时清空原数组，保证重复清理不会再次操作旧 channel。
   */
  private removeHandlers(): void {
    for (const channel of this.registeredChannels.splice(0).reverse()) {
      ipcMain.removeHandler(channel)
    }
  }
}
