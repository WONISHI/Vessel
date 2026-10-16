import { AppRouterContext, type RouterController } from "#vessel-react-router/router"
import type { RouterProviderProps } from "#vessel-react-router/types"
import { RouterProvider as ReactRouterProvider } from "react-router-dom"

/** Renders the router provider component. */
export function RouterProvider({ router }: RouterProviderProps) {
  const controller = router as RouterController

  return (
    <AppRouterContext.Provider value={controller}>
      <ReactRouterProvider router={controller.nativeRouter} />
    </AppRouterContext.Provider>
  )
}
