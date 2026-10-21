import { stat } from "node:fs/promises"

/** Count SQLite data and active WAL files; absent sidecars are normal. */
export async function getDatabaseStorageBytes(databasePath: string): Promise<number> {
  const sizes = await Promise.all([databasePath, `${databasePath}-wal`, `${databasePath}-shm`].map(async (path) => {
    try {
      return (await stat(path)).size
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") return 0
      throw error
    }
  }))
  return sizes.reduce((sum, size) => sum + size, 0)
}
