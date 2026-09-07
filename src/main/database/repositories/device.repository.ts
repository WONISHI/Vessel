import type Database from "better-sqlite3"

export interface DeviceRecord {
  id: string
  name: string
  hostname: string
  platform: string
  arch: string
  firstSeenAt: string
  lastSeenAt: string
}

export interface SaveDeviceInput {
  id: string
  name: string
  hostname: string
  platform: string
  arch: string
}

export class DeviceRepository {
  constructor(private readonly database: Database.Database) {}

  /**
   * 保存或更新设备。
   */
  saveDevice(input: SaveDeviceInput): DeviceRecord {
    const now = new Date().toISOString()

    this.database
      .prepare(
        `
        INSERT INTO devices (
          id,
          name,
          hostname,
          platform,
          arch,
          first_seen_at,
          last_seen_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id)
        DO UPDATE SET
          name = excluded.name,
          hostname = excluded.hostname,
          platform = excluded.platform,
          arch = excluded.arch,
          last_seen_at =
            excluded.last_seen_at
        `
      )
      .run(input.id, input.name, input.hostname, input.platform, input.arch, now, now)

    const device = this.findDeviceById(input.id)

    if (!device) {
      throw new Error("保存设备信息失败")
    }

    return device
  }

  /**
   * 根据 ID 查询设备。
   */
  findDeviceById(id: string): DeviceRecord | undefined {
    return this.database
      .prepare(
        `
        SELECT
          id,
          name,
          hostname,
          platform,
          arch,
          first_seen_at AS firstSeenAt,
          last_seen_at AS lastSeenAt
        FROM devices
        WHERE id = ?
        `
      )
      .get(id) as DeviceRecord | undefined
  }

  /**
   * 获取所有设备。
   */
  getDeviceList(): DeviceRecord[] {
    return this.database
      .prepare(
        `
        SELECT
          id,
          name,
          hostname,
          platform,
          arch,
          first_seen_at AS firstSeenAt,
          last_seen_at AS lastSeenAt
        FROM devices
        ORDER BY last_seen_at DESC
        `
      )
      .all() as DeviceRecord[]
  }
}
