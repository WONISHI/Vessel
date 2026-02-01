import { ipcMain, dialog } from 'electron';
import { basename } from "path"

export class OpenDirectoryFeature {
    private workspaceName: string = ''
    constructor() {

    }

    activate() {
        ipcMain.removeHandler('dialog:openDirectory');
        ipcMain.handle('dialog:openDirectory', async () => {
            const { canceled, filePaths } = await dialog.showOpenDialog({
                properties: ['openDirectory']
            });

            if (canceled) {
                return null;
            } else {
                this.workspaceName = basename(filePaths[0])
                return this.workspaceName
            }
        });
    }

    // 读取文件夹下的所有文件

}