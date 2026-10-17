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

发布环境默认读取 `process.resourcesPath/markitdown/bin/python3`，发布包需另外提供匹配目标平台的独立 Python 运行环境，或设置上述环境变量；项目虚拟环境不会自动进入发布包。不能直接复制依赖本机 Python 路径的虚拟环境作为独立运行时。

转换超时为 120 秒；失败时显示错误，不弹出保存对话框。转换临时文件会在成功或失败后清理。
