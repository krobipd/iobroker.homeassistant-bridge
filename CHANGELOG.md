# Changelog
## **WORK IN PROGRESS**

## 0.8.10 (2026-03-28)

- Consistent admin UI i18n keys (supportHeader)
- Add PayPal to FUNDING.yml

## 0.8.9 (2026-03-28)

- Use adapter timer methods (setInterval/clearInterval) instead of native timers
- Add Windows and macOS to CI test matrix
- README: standard license format with full MIT text
- Split old changelog entries into CHANGELOG_OLD.md

## 0.8.8 (2026-03-25)

- Simplified admin UI from tabs to single page layout
- Fixed onUnload to be synchronous (prevents SIGKILL on shutdown)
- Removed broken Ko-fi icon from donation button
- Added translate script

## 0.8.7 (2026-03-21)

- Fix repository URL format for Admin UI GitHub installation (remove `.git` suffix)

## 0.8.6 (2026-03-19)

- Admin UI fully translated into all 11 languages; i18n refactored to use short semantic keys

## 0.8.5 (2026-03-19)

- Admin UI: interface selector moved before port; port field removed (fixed at 8123)

## 0.8.4 (2026-03-19)

- Logging cleanup: auth flow, redirect, config details moved to debug level; remove redundant start/stop info messages

## 0.8.3 (2026-03-18)

- Remove unused `info.clients` state (was a misleading cumulative counter, not actual active connections)
- Remove dead code: `SessionData.flowId`, `connectedClients`, `AdapterInterface.setStateAsync`
- Simplify `createSession` signature

## 0.8.2 (2026-03-17)

- Migrate to @alcalzone/release-script for automated releases
- Enable npm Trusted Publishing (OIDC), remove legacy npm token

Older changes: [CHANGELOG_OLD.md](CHANGELOG_OLD.md)
