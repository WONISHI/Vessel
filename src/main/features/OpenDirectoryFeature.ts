// src/main/features/OpenDirectoryFeature.ts
import { ipcMain, dialog } from 'electron';
import { basename, join, extname } from "path";
import { readdir } from "fs/promises";

export class OpenDirectoryFeature {
    activate() {
        ipcMain.removeHandler('dialog:openDirectory');
        ipcMain.handle('dialog:openDirectory', async () => {
            const { canceled, filePaths } = await dialog.showOpenDialog({
                properties: ['openDirectory']
            });

            if (canceled || filePaths.length === 0) return null;

            const rootPath = filePaths[0];
            const name = basename(rootPath);
            
            // 异步递归获取 .md 文件
            const files = await this.readMarkdownFiles(rootPath);
            
            // 返回完整对象，与渲染进程的 WorkspaceData 结构对齐
            return {
                name: name,
                path: rootPath,
                files: files
            };
        });
    }

    private async readMarkdownFiles(dir: string): Promise<any[]> {
        try {
            const entries = await readdir(dir, { withFileTypes: true });
            const files = await Promise.all(entries.map(async (entry) => {
                const res = join(dir, entry.name);
                if (entry.isDirectory()) {
                    if (entry.name.startsWith('.')) return []; // 过滤隐藏目录
                    return this.readMarkdownFiles(res);
                } else if (extname(entry.name).toLowerCase() === '.md') {
                    return [{ name: entry.name, path: res }];
                }
                return [];
            }));
            return files.flat();
        } catch (e) {
            return [];
        }
    }
}