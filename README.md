# luci-app-mibox-ui

Web-first LuCI frontend for Mihomo on OpenWrt.

Project goals:
- UI style close to XKeen (status header, tabs, config editor, selectors, connections, logs)
- OpenWrt-native integration for service lifecycle and proxy mode (`TUN` / `TPROXY`)
- Theme-aware rendering (light/dark via current LuCI theme)
- Bilingual interface (`ru` / `en`)
- Foundation compatible with SSClash operational ideas

Current state:
- Bootstrap package structure is created
- Dashboard page is implemented as a LuCI view (`web inside LuCI`) in XKeen-like layout
- Service/mode/config/log/selectors/connections baseline is wired
- Advanced SSClash-style settings are integrated in the `Settings` tab:
  - interface processing mode (`exclude` / `explicit`)
  - proxy mode (`TPROXY` / `TUN` / `MIXED`) and TUN stack
  - WAN auto-detection and grouped interface selector
  - QUIC block, tmpfs storage, HWID headers
  - Mihomo kernel management (status/check/reinstall flow)
  - provider/rules refresh actions and hotplug hooks
- `temp/` is ignored in git and used only as a local reference source

Next milestones:
1. Wire live selector switching and richer connection metadata from Mihomo API
2. Add full settings panel for advanced SSClash-style options
3. Add tests/check scripts for JSON/YAML transformations and helper commands
