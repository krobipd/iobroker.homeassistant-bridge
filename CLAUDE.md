# CLAUDE.md - Projekt-Wissen für Claude

> **Hinweis:** Dieses Projekt nutzt die gemeinsame ioBroker-Wissensbasis unter `../CLAUDE.md` (lokal, nicht im Git-Repo). Diese enthält allgemeine Best Practices, Standard-Konfigurationen und Workflows für alle ioBroker-Adapter-Projekte. **Bitte beide Dateien aktuell halten** - Änderungen an Standards gehören in die globale Datei, projekt-spezifisches Wissen hierher.

## Projekt-Übersicht

**ioBroker HomeAssistant Bridge Adapter** - Emuliert einen minimalen Home Assistant Server, damit Geräte wie Shelly Wall Displays sich authentifizieren und dann auf ein ioBroker VIS Dashboard weitergeleitet werden können.

**Status: Feature Complete ✓** (März 2026)

## Shelly Wall Display - Wichtige Erkenntnisse

Das Zielgerät (Shelly Wall Display XL) hat spezifische Limitationen:

| Aspekt | Shelly Verhalten |
|--------|------------------|
| Protokoll | **Nur HTTP** - kein HTTPS Support für HA-Verbindungen |
| Discovery | mDNS (`_home-assistant._tcp`) oder manuelle IP |
| Auth | Erwartet vollständigen Home Assistant OAuth2-Flow |
| Nach Auth | Folgt 302 Redirects nativ im WebView |

Diese Limitationen bestimmen das Design des Adapters - wir emulieren nur was Shelly braucht und unterstützt.

## Architektur

```
src/
├── main.ts             → Adapter-Hauptklasse (extends utils.Adapter)
└── lib/
    ├── constants.ts    → Gemeinsame Konstanten (HA_VERSION, SESSION_TTL, etc.)
    ├── types.ts        → TypeScript Interfaces (AdapterConfig, SessionData, etc.)
    ├── webserver.ts    → Express 5 HTTP Server + HA API Emulation
    └── mdns.ts         → Avahi mDNS Service Discovery (nur Linux)
build/                  → Kompilierter JavaScript Code (gitignored)
admin/
├── jsonConfig.json     → Admin UI Konfiguration (Single Page, 4 Sektionen)
└── homeassistant-bridge.svg → Adapter Icon
.github/workflows/
└── test-and-release.yml  → Einziger Workflow: CI + Release bei Tag-Push
```

## Wichtige API-Endpoints

| Endpoint | Zweck |
|----------|-------|
| `/api/` | API Status Check (Shelly Discovery) |
| `/api/config` | Server-Konfiguration |
| `/api/discovery_info` | mDNS Discovery Info mit UUID |
| `/auth/providers` | Auth-Provider Liste |
| `/auth/login_flow` | OAuth2-ähnlicher Login Flow |
| `/auth/token` | Token-Austausch |
| `/` | 302 Redirect zu visUrl |

## Authentifizierungs-Flow

1. Device → POST `/auth/login_flow` → Server gibt `flow_id`
2. Device → POST `/auth/login_flow/:flowId` → Credentials prüfen
3. Server → gibt `authorization_code`
4. Device → POST `/auth/token` → Code gegen Access Token tauschen
5. Device → GET `/` → 302 Redirect zu konfigurierter visUrl

## Konfiguration (native)

```javascript
{
    port: 8123,           // HTTP Port
    bindAddress: "0.0.0.0", // Interface binden (0.0.0.0 = alle)
    visUrl: "",           // Redirect URL (MUSS gesetzt sein!)
    authRequired: false,  // Credentials validieren?
    username: "admin",    // Nur wenn authRequired=true
    password: "",         // Verschlüsselt via encryptedNative
    mdnsEnabled: true,    // Avahi mDNS Broadcasting
    serviceName: "ioBroker"  // Name im mDNS
}
```

## Projekt-spezifische Technologien

### Home Assistant API

- **Version 2026.3.1** (aktuell März 2026)
- `/api/discovery_info` muss `requires_api_password: true` haben
- UUID pro Instanz generieren (nicht statisch!)
- Auth-Flow muss vollständig durchlaufen werden

### mDNS/Avahi

- Service-Typ: `_home-assistant._tcp`
- Service-Datei: `/etc/avahi/services/homeassistant-bridge.service`
- `sudo chown iobroker /etc/avahi/services` für Berechtigungen
- Nur Linux unterstützt (Windows/macOS: manuelle URL-Eingabe)

## Häufige Probleme

### Shelly Display findet Server nicht
1. mDNS prüfen: `avahi-browse _home-assistant._tcp -r -t`
2. Service-Datei prüfen: `cat /etc/avahi/services/homeassistant-bridge.service`
3. Avahi Status: `systemctl status avahi-daemon`

### localhost in visUrl
- Display kann localhost nicht erreichen!
- Immer echte IP verwenden: `http://192.168.x.x:8082/vis/`

### Token Refresh schlägt fehl
- `grant_type: refresh_token` muss unterstützt werden
- Einfach neuen Token ausgeben (keine Validierung nötig)

## Git Repository

- **URL**: https://github.com/krobipd/ioBroker.homeassistant-bridge (großes B!)
- **Branch**: main
- **Autor**: krobi

## Status

**Auf npm veröffentlicht** ✅ — `iobroker.homeassistant-bridge@0.8.10`
**ioBroker Repository PR** ✅ — https://github.com/ioBroker/ioBroker.repositories/pull/5642 (ausstehend)
**Release-Pipeline** ✅ — vollautomatisch via `test-and-release.yml` (einziger Workflow!)

## i18n

- Struktur: `admin/i18n/{lang}/translations.json` (Unterordner pro Sprache)
- Alle 11 Sprachen vollständig übersetzt: en, de, ru, pt, nl, fr, it, es, pl, uk, zh-cn
- Kurze semantische Keys (z.B. `bindAddress`, `visUrlTooltip`, `mdnsInfo`) — KEINE langen englischen Sätze als Keys!

## Versionshistorie (Kurzfassung)

| Version | Änderungen |
|---------|------------|
| 0.8.10 | Konsistenter i18n-Key `supportHeader`, FUNDING.yml PayPal hinzugefügt |
| 0.8.9 | Adapter-Timer statt native setInterval, Windows/macOS CI, MIT-Volltext README, CHANGELOG_OLD.md |
| 0.8.8 | Single-Page Admin UI, sync onUnload fix, Ko-fi Icon entfernt, translate Script |
| 0.8.7 | Fix Repository-URL für Admin UI GitHub-Installation (.git Suffix entfernt) |
| 0.8.6 | Admin UI i18n: alle 11 Sprachen, kurze semantische Keys |
| 0.8.5 | Admin UI: Port-Feld entfernt (8123 fix), bindAddress zuerst; README Ports-Sektion |
| 0.8.4 | Logging cleanup: auth/redirect/config auf debug |
| 0.8.3 | Code cleanup: info.clients entfernt (misleading), dead code, DRY |
| 0.8.2 | npm Trusted Publishing fix: case-sensitive Repo-Name (ioBroker großes B) |
| 0.8.1 | Release-Pipeline Fix (alte Workflows entfernt, permissions hinzugefügt) |
| 0.8.0 | ioBroker-Konformität, alle Übersetzungen, PayPal Donation Link |
| 0.7.0 | Interface-Auswahl — bindAddress mit IP-Dropdown (type: "ip") |
| 0.6.0 | TypeScript Migration — src/ mit .ts Dateien, strict mode |

## Befehle

```bash
# Build (TypeScript → JavaScript)
npm run build
npm run watch        # Watch mode

# Lint & Format
npm run lint
npm run lint:fix
npm run format
npm run format:check

# Tests (111 Tests)
npm test                  # Alle Tests
npm run test:package      # Nur Package-Tests (für CI check-phase)
npm run test:integration  # Alle Tests (für CI test-phase)
npm run check             # TypeScript Typ-Prüfung ohne Build

# Release (via @alcalzone/release-script mit manual-review Plugin)
# → manual-review blockiert interaktiv, daher manueller Workaround:
# 1. CHANGELOG.md unter ## **WORK IN PROGRESS** befüllen
# 2. npm run build   (NICHT npm test — zerstört Production-Build!)
# 3. Version in package.json + io-package.json manuell bumpen
# 4. CHANGELOG: ## **WORK IN PROGRESS** → ## X.Y.Z (datum)
# 5. README: Badge + Changelog-Section aktualisieren
# 6. git add ... && git commit -m "chore: release vX.Y.Z"
# 7. git tag vX.Y.Z && git push && git push origin vX.Y.Z

# Adapter lokal testen
node build/main.js

# mDNS Service prüfen
avahi-browse _home-assistant._tcp -r -t
```

## Design-Philosophie

**Prinzip: Minimale Komplexität für den Zweck**

Der Adapter tut genau eine Sache: Shelly Wall Display zu einer beliebigen URL weiterleiten. Jede Entscheidung wurde daran gemessen:

1. **Braucht das Zielgerät (Shelly) dieses Feature?**
2. **Schützt es tatsächlich etwas Schützenswertes?**
3. **Rechtfertigt der Nutzen die Komplexität?**

Features die diese Fragen mit "Nein" beantworten, wurden bewusst nicht implementiert.

## Bewusst nicht implementiert

- **HTTPS Support**: Shelly Wall Display unterstützt kein HTTPS für Home-Assistant-Verbindungen. HTTPS würde nichts bringen und könnte die Kompatibilität brechen.

- **Rate Limiting**: Nicht sinnvoll - der Adapter macht nur URL-Redirects, es gibt keine schützenswerten Daten.

- **Windows/macOS mDNS (Bonjour)**: Manuelle IP-Eingabe funktioniert zuverlässig. ioBroker-Server laufen typischerweise auf Linux.

## Test-Abdeckung

```
test/
├── testConstants.ts    → Shared Constants (10 Tests)
├── testMdns.ts         → mDNS Service, XML Generation (17 Tests)
├── testWebServer.ts    → HTTP Endpoints, Auth, Sessions, bindAddress (30 Tests)
└── testPackageFiles.ts → @iobroker/testing Validierung (54 Tests)

Total: 111 Tests (alle TypeScript)
```

Die Tests werden mit `tsconfig.test.json` kompiliert und aus `build/test/` ausgeführt.
