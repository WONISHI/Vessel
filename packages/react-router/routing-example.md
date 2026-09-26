# 路由配置示例

以下为原始示例，页面组件需由使用方提供。

```tsx
import BasicLayout from "../layouts/BasicLayout"
import DebugPage from "../pages/DebugPage"
import HomePage from "../pages/HomePage"
import LoginPage from "../pages/LoginPage"
import NotFoundPage from "../pages/NotFoundPage"
import UserPage from "../pages/UserPage"

import {
  createRouter,
  createWebHashHistory,
  type AppRouteRecordRaw
} from "@vessel/react-router"

const routes: AppRouteRecordRaw[] = [
  {
    path: "/",
    component: BasicLayout,
    children: [
      {
        index: true,
        name: "home",
        component: HomePage,
        meta: {
          title: "首页"
        }
      },
      {
        path: "users/:id",
        name: "user-detail",
        component: UserPage,
        props: true,
        meta: {
          title: "用户详情",
          requiresAuth: true
        },
        beforeEnter: (to) => {
          if (!/^\d+$/.test(to.params.id || "")) {
            return {
              name: "home"
            }
          }
        }
      },
      {
        path: "debug",
        name: "debug",
        component: DebugPage,
        meta: {
          title: "调试页面"
        }
      }
    ]
  },
  {
    path: "/login",
    name: "login",
    component: LoginPage,
    meta: {
      title: "登录"
    }
  },
  {
    path: "/home",
    redirect: {
      name: "home"
    }
  },
  {
    path: "*",
    name: "not-found",
    component: NotFoundPage,
    meta: {
      title: "页面不存在"
    }
  }
]

const router = createRouter({
  // Electron 推荐 Hash；普通 Web 项目改成 createWebHistory()
  history: createWebHashHistory(),
  routes
})

router.beforeEach((to) => {
  const hasToken = Boolean(localStorage.getItem("token"))

  if (to.meta.requiresAuth && !hasToken) {
    return {
      name: "login",
      query: {
        redirect: to.fullPath
      }
    }
  }

  if (to.name === "login" && hasToken) {
    return {
      name: "home"
    }
  }
})

router.beforeResolve(async (to) => {
  if (to.meta.requiresAuth) {
    // 在这里执行进入页面前必须完成的异步检查
    await Promise.resolve()
  }
})

router.afterEach((to, _from, failure) => {
  if (!failure && typeof to.meta.title === "string") {
    document.title = to.meta.title
  }
})

router.onError((error) => {
  console.error("Router error:", error)
})

export default router

```
