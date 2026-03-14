# CLAUDE.md - Projekt-Wissen für Claude

## Projekt-Übersicht

**ioBroker HomeAssistant Bridge Adapter** - Emuliert einen minimalen Home Assistant Server, damit Geräte wie Shelly Wall Displays sich authentifizieren und dann auf ein ioBroker VIS Dashboard weitergeleitet werden können.

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

## Best Practices & Learnings

### ioBroker Adapter (März 2026)

- **js-controller 7.0.0+** erforderlich
- **Admin 7.0.0+** mit jsonConfig (nicht Materialize)
- **Node.js 20+** erforderlich
- **@iobroker/adapter-core 3.3.2** (aktuell)
- **encryptedNative** für Passwörter verwenden
- **protectedNative** verhindert API-Auslesen
- **tier: 3** für Community-Adapter

### Express 5 (März 2026)

- Bessere async/await Unterstützung
- Keine Breaking Changes für unseren Code
- `res.status(code).json(data)` Pattern verwenden

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
| 0.5.1 | HA_VERSION → 2026.3.1 |
| 0.5.0 | Express 5, ESLint 10, Dependencies März 2026 |
| 0.4.0 | js-controller 7, Admin 7, jsonConfig, encryptedNative |
| 0.3.0 | Code Cleanup, mDNS XML Bug Fix, Session Cleanup |

## Befehle

```bash
# Lint
npm run lint

# Test (noch keine Tests implementiert)
npm test

# Adapter lokal testen
node main.js

# mDNS Service prüfen
avahi-browse _home-assistant._tcp -r -t
```

## Offene TODOs

- [ ] Unit Tests implementieren
- [ ] README.md schreiben
- [ ] HTTPS Support (optional)
- [ ] Rate Limiting für Auth-Endpoints
- [ ] Windows/macOS mDNS Alternative (Bonjour)
