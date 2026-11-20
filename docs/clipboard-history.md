# 剪贴板历史

Vessel 运行期间自动记录系统复制内容。macOS 使用 **Control+V** 在当前屏幕底部打开面板，**Command+V** 继续正常粘贴。Windows / Linux 使用 **Ctrl+Shift+V** 打开历史，保留 Ctrl+V 粘贴。也可从应用菜单「编辑 → 剪贴板历史」进入。

- 点击卡片或按 Enter，恢复打开面板前的输入焦点并直接粘贴。卡片上的复制按钮仍只复制。
- 左右 / 上下方向键选择记录，Command+1–9（其他平台 Ctrl+1–9）直接粘贴对应项。
- 面板隐藏滚动条，使用鼠标滚轮或触控板横向浏览超出的卡片。
- Command+F 聚焦搜索；Shift+Enter 粘贴选中项的纯文本；Esc 收起面板。
- macOS 端外自动粘贴需要系统“辅助功能”权限；未授权时提示开启权限，内容仍可手动粘贴。Windows 自动恢复原窗口后发送粘贴快捷键；Linux 需要可用的 X11 `xdotool`。
- 支持文本、富文本、图片、链接、颜色和原生文件引用。文本搜索覆盖完整内容。
- 卡片上的固定按钮保留重要记录；顶部固定筛选只显示固定项。「保持面板展开」允许切换应用后继续显示。
- 更多菜单提供暂停记录、纯文本复制和清空未固定记录。删除、清空均保留当前系统剪贴板的内容。

历史保存在应用 userData 下的 `clipboard-history.sqlite`，暂停状态保存在 `clipboard-history-settings.json`。最多保留 200 条、合计 64 MiB；超限从最旧的未固定记录开始清理。单条上限 16 MiB，图片上限 2000 万像素。文件记录保存路径引用；图片保存原图，并提供缩略图。远程浏览器页面无法访问历史 IPC。

macOS 由独立的 `vessel-clipboard` 原生进程检查 NSPasteboard 的变化计数，每 250 ms 检查一次，变化时通知主进程读取内容。原生文件列表兼容多文件 URL 与旧版文件列表表示。系统标记为 concealed、transient、auto-generated 的内容会被跳过。原生监听不可用时，以及其他平台，使用每秒轮询。

面板是独立的透明 Electron 窗口，使用 macOS 原生 vibrancy 背景模糊，叠加半透明材质和边缘高光。独立 renderer / preload 避免加载工作区，也不向远程 webview 暴露历史数据。关闭最后一个用户窗口会销毁隐藏面板，退出时停止监听并释放全局快捷键。

`electron-vite build` 会生成独立 HTML / preload，以及签名后的 arm64 + x86_64 macOS 原生辅助程序。主进程、preload 或辅助程序变更后需要重启开发进程；安装版需要重新打包。

验证：

```sh
ELECTRON_RUN_AS_NODE=1 node_modules/electron/dist/Electron.app/Contents/MacOS/Electron node_modules/vitest/vitest.mjs run tests/main/clipboard-history.test.ts tests/renderer/clipboard-panel.test.tsx
npx electron-vite build
node scripts/smoke-clipboard.cjs
```

最后一项为 macOS 实测：使用临时历史库，备份系统剪贴板的全部原生条目和格式，验证复制、原生多文件、图片、富文本、暂停恢复及生产界面，最后恢复原系统剪贴板。测试需要启动独立 Electron 窗口。
