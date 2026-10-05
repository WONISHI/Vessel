# 截图与贴图

应用启动后，Windows 按 F1，macOS 按 Control+X，截取鼠标所在屏幕。使用 js-screen-shot（官方 npm 包 js-web-screen-shot）选择区域、绘制矩形/箭头/文字等标注。点击工具栏确认或按 Enter 后，图片复制到剪贴板并打开置顶贴图；Esc 取消截图。

贴图可通过标题栏或图片拖动，通过窗口边缘调整大小。标题栏提供复制、关闭按钮。截图仅在本地内存中处理，不上传。

macOS 首次需要授予屏幕录制权限；修改权限后可能需要完整重启应用。快捷键被其他应用占用时会提示错误。多屏环境当前截取鼠标所在的单个屏幕，不跨屏拼接。

来源：[likaia/js-screen-shot](https://github.com/likaia/js-screen-shot)，MIT 许可证。
