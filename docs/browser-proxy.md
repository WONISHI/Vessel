# Vessel 浏览器代理

在浏览器底栏点击 Waypoints 图标，粘贴 Clash YAML 订阅链接，点击连接。选择节点后，Vessel 内置浏览器的 HTTP/HTTPS 请求通过该节点；断开后恢复系统代理设置。不会启用 TUN 或修改系统代理。

首次连接下载 MetaCubeX/Mihomo v1.19.32 官方核心并验证 SHA-256。当前自动下载支持 macOS、Linux 的 arm64/x64；Windows 暂不支持。需要网络可访问 GitHub Releases。订阅需包含 proxies 或 HTTP/inline proxy-providers，不支持直接粘贴 Base64 节点列表。

订阅链接通过 Electron safeStorage 加密保存（不可用时仅保留于本次运行）；核心配置包含节点凭据，保存在应用 userData/browser-proxy，目录权限 0700、配置权限 0600。连接不自动恢复，重启后点击连接即可使用已保存订阅。

核心来源及许可证：[MetaCubeX/mihomo](https://github.com/MetaCubeX/mihomo)（GPL-3.0）；应用首次使用下载官方发布二进制，版本与摘要见 src/main/mihomo-release.json。
