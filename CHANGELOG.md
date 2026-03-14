# Changelog

## v0.4.0 — js-controller 7 & Admin 7 Update (14. März 2026)

### Breaking Changes

- **Node.js 20+** erforderlich (vorher Node.js 18+)
- **js-controller 7.0.0+** erforderlich (vorher 5.0.0+)
- **Admin 7.0.0+** erforderlich (vorher 6.0.0+)

### Neue Features

1. **jsonConfig Admin UI**
   - Moderne JSON-basierte Konfigurationsoberfläche
   - Drei Tabs: Haupteinstellungen, mDNS-Erkennung, Authentifizierung
   - Ersetzt das veraltete Materialize-Framework

2. **Verschlüsseltes Passwort**
   - `encryptedNative` für das Passwort-Feld
   - Passwort wird verschlüsselt in der Datenbank gespeichert
   - `protectedNative` verhindert Auslesen über API

3. **supportedMessages**
   - `stopInstance: true` für sauberes Herunterfahren

### Updates

- **@iobroker/adapter-core**: 3.2.2 → 3.3.2
- **Dependencies**: @eslint/js, globals, @iobroker/types hinzugefügt
- **ESLint 9**: Flat Config Format (`eslint.config.js`)
- **LICENSE**: MIT-Lizenz-Datei hinzugefügt
- **Repository URLs**: Korrigiert auf krobipd/iobroker.homeassistant-bridge

### Code-Qualität

- ESLint-Konfiguration hinzugefügt
- Lint-Fehler in `lib/mdns.js` behoben (curly braces)
- `tier: 3` in io-package.json gesetzt

---

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

---

## v0.2.0 — Vereinfachung (Februar 2026)

- Proxy-Funktion entfernt
- Nur noch Avahi für mDNS (kein Bonjour/multicast-dns)
- CORS entfernt

---

## v0.1.0 — Erstveröffentlichung (Februar 2026)

- Initiale Version
- Home Assistant API Emulation
- OAuth2-ähnlicher Authentifizierungsflow
- mDNS Service Discovery
- Redirect zu konfigurierbarer URL
