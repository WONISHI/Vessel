# @vessel/react-router

Vessel 内部 workspace 路由包，基于 React Router。源码由消费方 Vite 编译，不单独发布。

```tsx
import { createRouter, createWebHashHistory, useRoute } from "@vessel/react-router"
import { RouterProvider, RouterView } from "@vessel/react-router/components"
```

React、React DOM 和 React Router 由宿主提供，以共享路由上下文。
在仓库根目录运行 `npm run typecheck --workspace=@vessel/react-router` 检查此包。
根项目同时声明 npm workspaces 和 pnpm workspace，现有安装流程继续使用 pnpm。
