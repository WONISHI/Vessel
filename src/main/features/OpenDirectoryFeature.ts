import { ipcMain, dialog, BrowserWindow } from 'electron';
import { basename, join, extname } from 'path';
import { readdir, readFile, writeFile } from 'fs/promises';
import * as chokidar from 'chokidar';

interface FileNode {
  name: string;
  path: string;
  type: 'file' | 'directory';
  children?: FileNode[];
}

// ✅ 定义配置接口
interface FeatureOptions {
  extensions: string[]; // 例如: ['.md', '.txt', '.json']
}

export class OpenDirectoryFeature {
  private watcher: chokidar.FSWatcher | null = null;
  private mainWindow: BrowserWindow | null = null;
  
  // ✅ 保存允许的文件后缀 (使用 Set 提高查询性能)
  private allowedExtensions: Set<string>;

  /**
   * @param mainWindow 主窗口实例
   * @param options 配置项，默认只监听 .md
   */
  constructor(mainWindow: BrowserWindow, options: FeatureOptions = { extensions: ['.md'] }) {
    this.mainWindow = mainWindow;
    // ✅ 统一转为小写并确保带点，存入 Set
    this.allowedExtensions = new Set(
      options.extensions.map(ext => ext.startsWith('.') ? ext.toLowerCase() : `.${ext.toLowerCase()}`)
    );
  }

  activate() {
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

    ipcMain.handle('file:readContent', async (_, filePath) => {
      try {
        if (!filePath) return '';
        return await readFile(filePath, 'utf-8');
      } catch (e) {
        return '';
      }
    });

    ipcMain.handle('file:saveContent', async (_, filePath, content) => {
      try {
        await writeFile(filePath, content, 'utf-8');
        return true;
      } catch (error) {
        console.error('保存文件失败:', error);
        return false;
      }
    });

    ipcMain.handle('watcher:stop', () => {
      this.stopWatching();
    });
    
    // ✅ (可选) 新增：允许运行时动态更新文件过滤规则
    ipcMain.handle('config:updateExtensions', (_, extensions: string[]) => {
      this.allowedExtensions = new Set(
        extensions.map(ext => ext.startsWith('.') ? ext.toLowerCase() : `.${ext.toLowerCase()}`)
      );
      // 如果正在监听，可能需要通知前端重新刷新
      console.log('更新文件过滤器:', extensions);
      return true;
    });
  }

  /**
   * ✅ 核心辅助方法：检查文件是否符合配置
   */
  private isFileAllowed(filename: string): boolean {
    // 忽略隐藏文件
    if (filename.startsWith('.')) return false;
    
    const ext = extname(filename).toLowerCase();
    // 如果配置中包含 '.*'，则允许所有文件
    if (this.allowedExtensions.has('.*')) return true;
    
    return this.allowedExtensions.has(ext);
  }

  private startWatching(rootPath: string) {
    this.stopWatching();
    console.log(`开始监听目录: ${rootPath}`);

    this.watcher = chokidar.watch(rootPath, {
      ignored: /(^|[\/\\])\../, 
      persistent: true,
      ignoreInitial: true,
      depth: 99,
      awaitWriteFinish: {
        stabilityThreshold: 1000,
        pollInterval: 100
      }
    });

    const notifyRenderer = (event: string, filePath: string) => {
      if (this.mainWindow && !this.mainWindow.isDestroyed()) {
        
        // ✅ 优化：如果是文件变更事件，检查后缀名是否在白名单中
        // 如果是文件夹变更 (addDir, unlinkDir)，则总是通知
        const isDirEvent = event === 'addDir' || event === 'unlinkDir';
        
        if (!isDirEvent && !this.isFileAllowed(basename(filePath))) {
          // 如果文件类型不在允许列表中，忽略该事件，不发送给前端
          return;
        }

        console.log(`有效变动 [${event}]: ${filePath}`);
        this.mainWindow.webContents.send('file-system:changed', {
          event,
          path: filePath,
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

  private stopWatching() {
    if (this.watcher) {
      this.watcher.close();
      this.watcher = null;
    }
  }

  private async scanDirectory(dir: string): Promise<any[]> {
     try {
        const entries = await readdir(dir, { withFileTypes: true })
        const nodes = await Promise.all(
          entries.map(async (entry) => {
            const fullPath = join(dir, entry.name)

            // 忽略隐藏文件
            if (entry.name.startsWith(".")) return null;

            if (entry.isDirectory()) {
              const children = await this.scanDirectory(fullPath)
              return {
                name: entry.name,
                path: fullPath,
                type: "directory",
                children,
              }
            } 
            // ✅ 使用通用的判断逻辑
            else if (this.isFileAllowed(entry.name)) {
              return { name: entry.name, path: fullPath, type: "file" }
            }
            return null
          }),
        )
        // 排序逻辑保持不变
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