import { ComponentType, lazy, LazyExoticComponent } from "react"

/**
 * 包装动态 import()，当遇到 Vite HMR 重启、开发服务器重载或网络偶发异常时自动重试
 */
export function lazyWithRetry<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>,
  retries = 2,
  interval = 400
): LazyExoticComponent<T> {
  return lazy(() =>
    new Promise<{ default: T }>((resolve, reject) => {
      const attempt = (remaining: number) => {
        factory()
          .then(resolve)
          .catch((error) => {
            if (remaining > 0) {
              setTimeout(() => attempt(remaining - 1), interval)
            } else {
              reject(error)
            }
          })
      }
      attempt(retries)
    })
  )
}
