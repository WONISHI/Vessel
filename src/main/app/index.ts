import { WelcomeModule } from "../modules/welcome/index.module"
import { type BaseModule, type ModuleConstructor } from "../modules/base/index"

const MODULES: ModuleConstructor[] = [WelcomeModule]

class MainApps {
  private modules: BaseModule[] = []

  activate(): void {
    if (this.modules.length > 0) return

    const modules = MODULES.map((Module) => new Module())
    const activatedModules: BaseModule[] = []

    try {
      for (const module of modules) {
        module.activate()
        activatedModules.push(module)
      }

      this.modules = modules
    } catch (error) {
      for (const module of activatedModules.reverse()) {
        module.dispose()
      }

      throw error
    }
  }

  dispose(): void {
    for (const module of this.modules.splice(0).reverse()) {
      module.dispose()
    }
  }
}

export const mainApps = new MainApps()
