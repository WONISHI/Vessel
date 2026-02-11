import { ipcMain, dialog, BrowserWindow } from 'electron';
import { basename, join, extname } from 'path';
import { readdir, readFile, writeFile } from 'fs/promises';
import * as chokidar from 'chokidar'; // 引入 chokidar

interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: FileNode[];
}

export class OpenDirectoryFeature {
  // 保存当前的 watcher 实例
  private watcher: chokidar.FSWatcher | null = null;
  // 保存当前主窗口引用，用于发送通知
  private mainWindow: BrowserWindow | null = null;

  constructor(mainWindow: BrowserWindow) {
    this.mainWindow = mainWindow;
  }

  activate() {
    // 1. 选择并扫描目录 (同时开启监听)
    ipcMain.handle('dialog:openDirectory', async () => {
      const { canceled, filePaths } = await dialog.showOpenDialog({
        properties: ['openDirectory']
      });
      
      if (canceled || filePaths.length === 0) return null;

      const rootPath = filePaths[0];
      
      this.startWatching(rootPath);

      const tree = await this.scanDirectory(rootPath);
      return { name: basename(rootPath), path: rootPath, files: tree };
    });

    // 2. 读取文件内容
    ipcMain.handle('file:readContent', async (_, filePath) => {
      try {
        if (!filePath) return '';
        return await readFile(filePath, 'utf-8');
      } catch (e) {
        return '';
      }
    });

    // 3. 保存文件内容
    ipcMain.handle('file:saveContent', async (_, filePath, content) => {
      try {
        await writeFile(filePath, content, 'utf-8');
        return true;
      } catch (error) {
        console.error('保存文件失败:', error);
        return false;
      }
    });

    // 4. (可选) 提供一个手动停止监听的方法
    ipcMain.handle('watcher:stop', () => {
      this.stopWatching();
    });
  }

  /**
   * 开启文件监听
   * @param rootPath 要监听的根目录路径
   */
  private startWatching(rootPath: string) {
    // 1. 如果已有监听器，先关闭，防止重复监听多个目录
    this.stopWatching();

    console.log(`开始监听目录: ${rootPath}`);

    // 2. 初始化 chokidar
    this.watcher = chokidar.watch(rootPath, {
      ignored: /(^|[\/\\])\../, // 忽略隐藏文件 (以 . 开头的文件/文件夹)
      persistent: true,
      ignoreInitial: true, // 忽略初始化时的 add 事件，只监听后续变化
      depth: 99, // 递归深度
      awaitWriteFinish: { // 等待写入完成（防止文件还在写入时就触发 change）
        stabilityThreshold: 1000,
        pollInterval: 100
      }
    });

    const notifyRenderer = (event: string, path: string) => {
      // 只有当窗口存在且未销毁时才发送
      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        console.log(`文件变动 [${event}]: ${path}`);
        this.mainWindow.webContents.send('file-system:changed', {
          event,
          path,
          rootPath
        });
      }
    };

    this.watcher
      .on('add', path => notifyRenderer('add', path))
      .on('change', path => notifyRenderer('change', path))
      .on('unlink', path => notifyRenderer('unlink', path))
      .on('addDir', path => notifyRenderer('addDir', path))
      .on('unlinkDir', path => notifyRenderer('unlinkDir', path))
      .on('error', error => console.error(`Watcher error: ${error}`));
  }

  /**
   * 停止监听并清理资源
   */
  private stopWatching() {
    if (this.watcher) {
      this.watcher.close().then(() => console.log('Watcher closed'));
      this.watcher = null;
    }
  }

  private async scanDirectory(dir: string): Promise<any[]> {
     try {
        const entries = await readdir(dir, { withFileTypes: true })
        const nodes = await Promise.all(
          entries.map(async (entry) => {
            const fullPath = join(dir, entry.name)

            if (entry.isDirectory()) {
              const children = await this.scanDirectory(fullPath)
              return {
                name: entry.name,
                path: fullPath,
                type: "directory",
                children,
              }
            } else if (extname(entry.name).toLowerCase() === ".md") {
              return { name: entry.name, path: fullPath, type: "file" }
            }
            return null
          }),
        )
        return (nodes.filter(Boolean) as FileNode[]).sort((a, b) =>
          a.type === b.type
            ? a.name.localeCompare(b.name)
            : a.type === "directory"
              ? -1
              : 1,
        )
      } catch (e) {
        return []
      }
  }
}