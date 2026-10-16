export type ModuleConstructor<T extends BaseModule = BaseModule> = new () => T

type ModuleState = "inactive" | "activating" | "active" | "disposing"

export abstract class BaseModule {
  private state: ModuleState = "inactive"

  /** Performs the active operation. */
  get active(): boolean {
    return this.state === "active"
  }

  /** Performs the activate operation. */
  activate(): void {
    if (this.state === "active" || this.state === "activating") return

    this.state = "activating"

    try {
      this.onActivate()
      this.state = "active"
    } catch (error) {
      this.state = "inactive"
      throw error
    }
  }

  /** Disposes dispose. */
  dispose(): void {
    if (this.state === "inactive" || this.state === "disposing") return

    this.state = "disposing"

    try {
      this.onDispose()
    } finally {
      this.state = "inactive"
    }
  }

  protected abstract onActivate(): void

  protected abstract onDispose(): void
}
