import type { DatabaseMigration } from "@main/database/type"

export const DATABASE_MIGRATIONS: readonly DatabaseMigration[] = [
  {
    version: 1,
    description: "创建 Vessel 初始数据库结构",
    sql: `
      -- 应用内部元数据。
      -- 当前用于保存不会随应用重启变化的设备 ID。
      CREATE TABLE IF NOT EXISTS app_metadata (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      -- 当前设备的软硬件环境和应用运行版本。
      CREATE TABLE IF NOT EXISTS devices (
        id TEXT PRIMARY KEY,
        hostname TEXT NOT NULL,
        platform TEXT NOT NULL,
        arch TEXT NOT NULL,
        os_type TEXT NOT NULL,
        os_release TEXT NOT NULL,
        os_version TEXT NOT NULL,
        cpu_model TEXT NOT NULL,
        cpu_count INTEGER NOT NULL,
        total_memory INTEGER NOT NULL,
        locale TEXT NOT NULL,
        timezone TEXT NOT NULL,
        app_version TEXT NOT NULL,
        electron_version TEXT NOT NULL,
        node_version TEXT NOT NULL,
        first_seen_at TEXT NOT NULL,
        last_seen_at TEXT NOT NULL
      );

      -- 每次启动应用都会创建一条会话。
      -- 应用退出时为 ended_at 补充结束时间。
      CREATE TABLE IF NOT EXISTS app_sessions (
        id TEXT PRIMARY KEY,
        device_id TEXT NOT NULL,
        started_at TEXT NOT NULL,
        ended_at TEXT,
        app_version TEXT NOT NULL,
        electron_version TEXT NOT NULL,
        node_version TEXT NOT NULL,
        platform TEXT NOT NULL,
        arch TEXT NOT NULL,
        FOREIGN KEY (
          device_id
        ) REFERENCES devices(id)
      );

      -- 工作区汇总表。
      -- 同一个规范路径只保留一条数据并累计打开次数。
      CREATE TABLE IF NOT EXISTS workspaces (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        path TEXT NOT NULL,
        normalized_path TEXT NOT NULL UNIQUE,
        file_count INTEGER NOT NULL DEFAULT 0,
        first_opened_at TEXT NOT NULL,
        last_opened_at TEXT NOT NULL,
        open_count INTEGER NOT NULL DEFAULT 1,
        is_available INTEGER NOT NULL DEFAULT 1,
        last_device_id TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (
          last_device_id
        ) REFERENCES devices(id)
      );

      -- 工作区打开明细表。
      -- 每次打开工作区都会追加一条记录。
      CREATE TABLE IF NOT EXISTS workspace_open_records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        workspace_id INTEGER NOT NULL,
        device_id TEXT NOT NULL,
        session_id TEXT NOT NULL,
        path TEXT NOT NULL,
        file_count INTEGER NOT NULL DEFAULT 0,
        opened_at TEXT NOT NULL,
        app_version TEXT NOT NULL,
        electron_version TEXT NOT NULL,
        platform TEXT NOT NULL,
        arch TEXT NOT NULL,
        FOREIGN KEY (
          workspace_id
        ) REFERENCES workspaces(id)
          ON DELETE CASCADE,
        FOREIGN KEY (
          device_id
        ) REFERENCES devices(id),
        FOREIGN KEY (
          session_id
        ) REFERENCES app_sessions(id)
      );

      -- 通用应用状态表。
      -- 用于保存主题、布局、编辑器设置等 JSON 数据。
      CREATE TABLE IF NOT EXISTS app_state (
        key TEXT PRIMARY KEY,
        value_json TEXT NOT NULL,
        device_id TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (
          device_id
        ) REFERENCES devices(id)
      );

      -- 最近打开工作区查询索引。
      CREATE INDEX IF NOT EXISTS
        idx_workspaces_last_opened_at
      ON workspaces(
        last_opened_at DESC
      );

      -- 按工作区查询打开明细的索引。
      CREATE INDEX IF NOT EXISTS
        idx_workspace_open_records_workspace_id
      ON workspace_open_records(
        workspace_id,
        opened_at DESC
      );

      -- 按设备查询打开明细的索引。
      CREATE INDEX IF NOT EXISTS
        idx_workspace_open_records_device_id
      ON workspace_open_records(
        device_id,
        opened_at DESC
      );
    `
  },
  {
    version: 2,
    description: "为工作区打开记录增加设备环境快照",
    sql: `
      ALTER TABLE workspace_open_records
        ADD COLUMN hostname
        TEXT NOT NULL
        DEFAULT 'unknown';

      ALTER TABLE workspace_open_records
        ADD COLUMN os_type
        TEXT NOT NULL
        DEFAULT 'unknown';

      ALTER TABLE workspace_open_records
        ADD COLUMN os_release
        TEXT NOT NULL
        DEFAULT 'unknown';

      ALTER TABLE workspace_open_records
        ADD COLUMN os_version
        TEXT NOT NULL
        DEFAULT 'unknown';

      ALTER TABLE workspace_open_records
        ADD COLUMN cpu_model
        TEXT NOT NULL
        DEFAULT 'unknown';

      ALTER TABLE workspace_open_records
        ADD COLUMN cpu_count
        INTEGER NOT NULL
        DEFAULT 0;

      ALTER TABLE workspace_open_records
        ADD COLUMN total_memory
        INTEGER NOT NULL
        DEFAULT 0;

      ALTER TABLE workspace_open_records
        ADD COLUMN locale
        TEXT NOT NULL
        DEFAULT 'unknown';

      ALTER TABLE workspace_open_records
        ADD COLUMN timezone
        TEXT NOT NULL
        DEFAULT 'unknown';

      ALTER TABLE workspace_open_records
        ADD COLUMN node_version
        TEXT NOT NULL
        DEFAULT 'unknown';

      -- 版本 1 的记录没有完整设备快照。
      -- 使用关联设备的信息进行一次回填。
      UPDATE workspace_open_records
      SET
        hostname = COALESCE(
          (
            SELECT devices.hostname
            FROM devices
            WHERE devices.id =
              workspace_open_records.device_id
          ),
          'unknown'
        ),

        os_type = COALESCE(
          (
            SELECT devices.os_type
            FROM devices
            WHERE devices.id =
              workspace_open_records.device_id
          ),
          'unknown'
        ),

        os_release = COALESCE(
          (
            SELECT devices.os_release
            FROM devices
            WHERE devices.id =
              workspace_open_records.device_id
          ),
          'unknown'
        ),

        os_version = COALESCE(
          (
            SELECT devices.os_version
            FROM devices
            WHERE devices.id =
              workspace_open_records.device_id
          ),
          'unknown'
        ),

        cpu_model = COALESCE(
          (
            SELECT devices.cpu_model
            FROM devices
            WHERE devices.id =
              workspace_open_records.device_id
          ),
          'unknown'
        ),

        cpu_count = COALESCE(
          (
            SELECT devices.cpu_count
            FROM devices
            WHERE devices.id =
              workspace_open_records.device_id
          ),
          0
        ),

        total_memory = COALESCE(
          (
            SELECT devices.total_memory
            FROM devices
            WHERE devices.id =
              workspace_open_records.device_id
          ),
          0
        ),

        locale = COALESCE(
          (
            SELECT devices.locale
            FROM devices
            WHERE devices.id =
              workspace_open_records.device_id
          ),
          'unknown'
        ),

        timezone = COALESCE(
          (
            SELECT devices.timezone
            FROM devices
            WHERE devices.id =
              workspace_open_records.device_id
          ),
          'unknown'
        ),

        node_version = COALESCE(
          (
            SELECT devices.node_version
            FROM devices
            WHERE devices.id =
              workspace_open_records.device_id
          ),
          'unknown'
        );
    `
  }
]

/**
 * 当前应用支持的数据库版本。
 *
 * 自动取迁移列表中的最大版本，
 * 不需要再单独手动维护版本数字。
 */
export const DATABASE_VERSION = DATABASE_MIGRATIONS.reduce((maximumVersion, migration) => {
  return Math.max(maximumVersion, migration.version)
}, 0)
