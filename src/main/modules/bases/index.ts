import { queryWorkspaceBase } from "@main/modules/bases/query-base"
import type { WebContents } from "electron"

/** Registers the window-scoped, read-only Bases query endpoint. */
export function registerBases(contents: WebContents) {
  contents.ipc.handle("obsidian:query-base", (_event, root: string, path: string, viewIndex?: number) => queryWorkspaceBase(root, path, viewIndex))
}
