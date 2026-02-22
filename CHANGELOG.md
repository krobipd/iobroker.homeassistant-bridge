# Changelog

## v0.3.0 — Code-Cleanup & Bug-Fixes (18. Februar 2026)

### Bug-Fixes

1. **mdns.js — XML Closing Tag (KRITISCH)**
   - `</n>` → `</name>` — Avahi konnte die Service-Datei nicht parsen
   - Service wurde nie korrekt registriert, mDNS-Discovery war dadurch unmöglich
   
2. **webserver.js — requires_api_password in /api/discovery_info**
   - War dynamisch an `authRequired` gebunden statt hardcoded `true`
   - Display übersprang bei `false` den Auth-Flow über diesen Endpoint

3. **webserver.js — Token Refresh**
   - `grant_type: refresh_token` wurde nicht unterstützt → Display verlor Verbindung nach Token-Ablauf

### Optimierungen (DRY / KISS)

- **Dependencies reduziert:** `uuid` und `body-parser` entfernt
  - `crypto.randomUUID()` (Node 18+ built-in) ersetzt `uuid`
  - `express.json()` / `express.urlencoded()` (Express 4.16+ built-in) ersetzt `body-parser`
- **Konstanten extrahiert:** `HA_VERSION`, `LOGIN_SCHEMA`, `SESSION_TTL_MS` — keine Magic Values mehr
- **Session-Cleanup:** Timer räumt abgelaufene Sessions alle 5 Min auf (vorher: nie)
- **Log-Level:** Request-Logging auf `debug` statt `info` — Production-Logs sind sauber
- **Route-Setup modularisiert:** `setupApiRoutes()`, `setupAuthRoutes()`, `setupMiscRoutes()`
- **serviceName Getter:** Eliminiert `this.config.serviceName || 'ioBroker'` Wiederholungen
- **main.js:** `setStateAsync` statt `setState`, `finally` Block in `onUnload`
- **mdns.js:** `buildServiceXml()` als eigene Methode, `reloadAvahi()` DRY
- **io-package.json:** `visUrl` Default auf leer statt `localhost` (verhindert Fehlkonfiguration)
- **Encoding fix:** `°C` statt `Â°C` in unit_system

### Dateistruktur (unverändert)

```
homeassistant-bridge/
├── main.js              — Adapter-Core
├── lib/
│   ├── webserver.js     — Express Server + HA-API + Auth
│   └── mdns.js          — Avahi mDNS Service
├── package.json
└── io-package.json
```

### Zum mDNS-Problem

Der XML-Bug in mdns.js war mit hoher Wahrscheinlichkeit der Hauptgrund, warum das Shelly Display den Service nie gefunden hat. Mit dem Fix sollte Avahi die Service-Datei korrekt parsen und `_home-assistant._tcp` broadcasten. Test nach Update:

```bash
# Adapter neu starten
iobroker restart homeassistant-bridge

# Service-Datei prüfen (muss valides XML sein)
cat /etc/avahi/services/homeassistant-bridge.service

# mDNS-Broadcast verifizieren
avahi-browse _home-assistant._tcp -r -t
```

Falls das Display den Service danach immer noch nicht findet, liegt es am Display selbst — nicht am Adapter.
