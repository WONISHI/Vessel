import { ipcMain, dialog } from 'electron';
import { basename, join, extname } from "path";
import { readdir, readFile, writeFile } from "fs/promises";

interface FileNode {
    name: string;
    path: string;
    type: 'file' | 'directory';
    children?: FileNode[];
}

export class OpenDirectoryFeature {
    activate() {
        // 1. 选择并扫描目录
        ipcMain.handle('dialog:openDirectory', async () => {
            const { canceled, filePaths } = await dialog.showOpenDialog({
                properties: ['openDirectory']
            });
            if (canceled || filePaths.length === 0) return null;

            const rootPath = filePaths[0];
            const tree = await this.scanDirectory(rootPath);
            return { name: basename(rootPath), path: rootPath, files: tree };
        });

        // 2. 读取文件内容 (注意参数顺序：_, path)
        ipcMain.handle('file:readContent', async (_, filePath: string) => {
            try {
                if (!filePath) return "";
                return await readFile(filePath, 'utf-8');
            } catch (e) {
                return "";
            }
        });

        ipcMain.handle('file:saveContent', async (_, filePath: string, content: string) => {
            try {
                await writeFile(filePath, content, 'utf-8');
                return true;
            } catch (error) {
                console.error("保存文件失败:", error);
                return false;
            }
        });
    }

    private async scanDirectory(dir: string): Promise<FileNode[]> {
        try {
            const entries = await readdir(dir, { withFileTypes: true });
            const nodes = await Promise.all(entries.map(async (entry) => {
                const fullPath = join(dir, entry.name);
                if (entry.name.startsWith('.')) return null;

                if (entry.isDirectory()) {
                    const children = await this.scanDirectory(fullPath);
                    return { name: entry.name, path: fullPath, type: 'directory', children };
                } else if (extname(entry.name).toLowerCase() === '.md') {
                    return { name: entry.name, path: fullPath, type: 'file' };
                }
                return null;
            }));
            return (nodes.filter(Boolean) as FileNode[]).sort((a, b) =>
                a.type === b.type ? a.name.localeCompare(b.name) : (a.type === 'directory' ? -1 : 1)
            );
        } catch (e) { return []; }
    }
}