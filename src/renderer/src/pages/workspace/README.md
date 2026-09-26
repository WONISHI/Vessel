# 工作区页面

`index.tsx` 组装页面；根 `layout` 仅接收 aside 与 children，不读取业务 Context，也不决定路由。

- `hooks/useWorkspaceController.ts`：文件标签、选中文件、目录展开及导航逻辑。
- `contexts/`、`types/`：页面级共享状态与类型。
- `components/layout-aside/`：页面专属活动栏和懒加载文件树。
- `components/layout-main/`：标签栏、首页、文件内容及路由出口。
- `@vessel/utils`：无 UI 依赖的文件计数、路径树构建和扩展名提取。

懒加载文件树通过 Electron 接口读取目录；类型配色属于页面展示逻辑，留在页面组件中。
