# @vessel/utils

跨页面、跨运行环境的纯工具函数。源码由宿主构建，不访问文件系统，不依赖 React。

- `getFileExtension(path)`：识别文件类型，返回小写扩展名。
- `countFileNodes(nodes)`：统计已加载文件节点，不把未加载目录计作文件。
- `createFileTreeFromPaths(files, rootPath)`：将扁平路径恢复为目录树，用于兼容旧扫描结果。懒加载文件树不需要预先调用它。

每个导出函数提供 TSDoc 用途、参数与返回值说明。UI 配色、工作区状态和路由行为仍由页面维护。

运行 `npm run typecheck --workspace=@vessel/utils` 检查包类型。
