# ONLYOFFICE 转为 Markdown

文档工具栏的“转为 Markdown”会先导出当前编辑内容（包含未保存修改），由主进程调用本地 MarkItDown。转换成功后选择保存文件夹，输出同名 `.md`；同名文件已存在时自动加编号。取消保存不会修改原文档。

支持当前 Office 编辑器导出的 DOCX、XLSX、PPTX，以及打开的 PDF。扫描 PDF 的 OCR 不包含在此基础转换中。

## 本地运行环境

使用 Python 3.10+ 创建独立环境（macOS 自带 Python 3.9 不适用）：

```sh
python3 -m venv .venv-markitdown
.venv-markitdown/bin/python -m pip install -r resources/markitdown-requirements.txt
```

开发模式默认读取项目 `.venv-markitdown/bin/python3`。也可以设置 `VESSEL_MARKITDOWN_PYTHON` 为已安装上述依赖的 Python 绝对路径。

发布包通过 electron-builder 的 `beforePack` 自动下载独立 CPython 并安装固定版本的 MarkItDown，复制到 `resources/markitdown`。首次打包需要网络，后续复用通过版本、架构和依赖校验的运行时。也可提前执行 `npm run assets:markitdown`；执行 `node scripts/prepare-markitdown.cjs --check` 可检查环境。

macOS/Linux 使用 `process.resourcesPath/markitdown/bin/python3`，Windows 使用 `process.resourcesPath/markitdown/python.exe`，用户无需安装 Python。打包后会从应用资源目录实际启动 Python 并检查 PDF 转换器导入，校验失败则终止打包。请在目标系统和架构上打包，暂不支持跨平台、跨架构或 universal 打包。项目开发虚拟环境不会进入发布包。

转换超时为 120 秒；失败时显示错误，不弹出保存对话框。转换临时文件会在成功或失败后清理。
