# CLAUDE.md - Projekt-Wissen für Claude

> **Hinweis:** Dieses Projekt nutzt die gemeinsame ioBroker-Wissensbasis unter `../CLAUDE.md`. Diese enthält allgemeine Best Practices, Standard-Konfigurationen und Workflows für alle ioBroker-Adapter-Projekte. Die vorliegende Datei ergänzt diese mit projekt-spezifischen Details.

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
main.js                 → Adapter-Hauptklasse (extends utils.Adapter)
lib/
├── constants.js        → Gemeinsame Konstanten (HA_VERSION, SESSION_TTL, etc.)
├── webserver.js        → Express 5 HTTP Server + HA API Emulation
└── mdns.js             → Avahi mDNS Service Discovery (nur Linux)
admin/
├── jsonConfig.json     → Admin UI Konfiguration (3 Tabs)
└── homeassistant-bridge.svg → Adapter Icon
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

- **URL**: https://github.com/krobipd/iobroker.homeassistant-bridge
- **Branch**: main
- **Autor**: krobi

## Versionshistorie (Kurzfassung)

| Version | Änderungen |
|---------|------------|
| 0.5.2 | @iobroker/eslint-config + Prettier |
| 0.5.1 | HA_VERSION → 2026.3.1 |
| 0.5.0 | Express 5, Dependencies März 2026 |
| 0.4.0 | js-controller 7, Admin 7, jsonConfig, encryptedNative |
| 0.3.0 | Code Cleanup, mDNS XML Bug Fix, Session Cleanup |

## Befehle

```bash
# Lint & Format
npm run lint
npm run lint:fix
npm run format
npm run format:check

# Tests (95 Tests)
npm test
npm run test:ci

# Adapter lokal testen
node main.js

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
├── testConstants.js    → Shared Constants (10 Tests)
├── testWebServer.js    → HTTP Endpoints, Auth, Sessions (26 Tests)
├── testMdns.js         → mDNS Service, XML Generation (17 Tests)
└── testPackageFiles.js → @iobroker/testing Validierung (42 Tests)

Total: 95 Tests
```
