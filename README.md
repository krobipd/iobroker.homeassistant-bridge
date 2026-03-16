# ioBroker.homeassistant-bridge

![Version](https://img.shields.io/badge/version-0.8.1-blue)
![Node](https://img.shields.io/badge/node-%3E%3D20-brightgreen)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue)
![License](https://img.shields.io/badge/license-MIT-green)
[![PayPal](https://img.shields.io/badge/Donate-PayPal-blue.svg)](https://paypal.me/krobipd)

A minimal Home Assistant emulator for ioBroker.

This adapter allows devices that only support Home Assistant dashboards to connect to a fake Home Assistant server and be redirected to any custom web URL.

---

## Purpose

Devices like the **Shelly Wall Display XL** officially only allow connection to a Home Assistant server.

With this bridge, you can display:

- an ioBroker VIS dashboard
- a VIS-2 instance
- a custom dashboard
- or any internal/external web application

**without running a real Home Assistant Core**.

---

## Tested Devices

- Shelly Wall Display XL

This allows running an ioBroker VIS natively on the Wall Display.

---

## How It Works

The adapter:

- Emulates relevant Home Assistant API endpoints
- Provides a `_home-assistant._tcp` mDNS service
- Implements a minimal OAuth2-like auth flow
- Redirects to the configured target URL after successful authentication

The display recognizes the bridge as a Home Assistant server.

---

## Requirements

- **Node.js >= 20**
- **ioBroker js-controller >= 7.0.0**
- **ioBroker Admin >= 7.6.20**
- Linux system with Avahi (for mDNS)

---

## Installation

```bash
cd /opt/iobroker
npm install iobroker.homeassistant-bridge
iobroker add homeassistant-bridge
```

Or via the ioBroker Admin UI: Adapters -> Search for "homeassistant-bridge".

---

## Configuration

Configuration is done via the Admin UI (jsonConfig):

| Option | Description | Default |
|--------|-------------|---------|
| **Port** | HTTP port for the server | 8123 |
| **Bind to Interface** | Network interface to listen on | 0.0.0.0 (all) |
| **Redirect URL** | Target URL for the display (e.g., VIS) | *must be set* |
| **mDNS Enabled** | Avahi Service Discovery | enabled |
| **Service Name** | Name in the network | "ioBroker" |
| **Auth Required** | Validate credentials | disabled |
| **Username** | Login name (if auth enabled) | "admin" |
| **Password** | Login password (stored encrypted) | - |

**Important:** The redirect URL must be a network-accessible address, e.g.:
```
http://192.168.1.100:8082/vis/index.html
```

`localhost` will not work because the display calls the URL!

---

## mDNS Note

The adapter registers a `_home-assistant._tcp` service via Avahi for automatic discovery.

In my tests, automatic discovery did not work reliably. Manual configuration works stably:

```
IP:   <ioBroker-IP>
Port: 8123
```

---

## Troubleshooting

### Display cannot find the server (mDNS)

1. Check if Avahi is running:
   ```bash
   systemctl status avahi-daemon
   ```

2. Check if the service is registered:
   ```bash
   avahi-browse _home-assistant._tcp -r -t
   ```

3. If mDNS doesn't work, use manual configuration on the display with the ioBroker server's IP address.

### Avahi Permission Error

```bash
sudo chown iobroker /etc/avahi/services
```

### Health Check

The adapter provides a health endpoint:
```
http://<IP>:8123/health
```

---

## Development

The adapter is written entirely in **TypeScript** with `strict` mode.

```bash
# Build
npm run build

# Tests (99 tests)
npm test

# Lint
npm run lint

# Watch mode for development
npm run watch
```

### Project Structure

```
src/
├── main.ts           # Adapter main class
└── lib/
    ├── constants.ts  # Shared constants
    ├── types.ts      # TypeScript interfaces
    ├── webserver.ts  # Express HTTP server
    └── mdns.ts       # Avahi mDNS service
test/                 # TypeScript tests
build/                # Compiled JavaScript code
```

---

## Changelog

### 0.8.1 (2026-03-16)
- Fix automated release pipeline (remove legacy ci.yml and release.yml workflows)

### 0.8.0 (2026-03-16)
- ioBroker repository compliance: official testing actions, all translations, donation link

### 0.7.0 (2026-03-16)
- Added network interface selection dropdown for bind address

### 0.6.3 (2026-03-15)
- Fixed repository URL format for Admin UI GitHub installation

### 0.6.2 (2026-03-15)
- Added complete JSDoc documentation
- ESLint now passes without warnings

### 0.6.1 (2026-03-15)
- Added GitHub Actions CI and release workflows

### 0.6.0 (2026-03-14)
- Migrated to TypeScript with strict mode

### 0.5.0 (2026-03-13)
- Express 5 upgrade
- All dependencies updated to March 2026 versions

### 0.4.0 (2026-03-12)
- Updated for js-controller 7 & Admin 7
- jsonConfig UI
- Node.js 20+ required
- encryptedNative for password

### 0.3.0 (2026-03-11)
- Code cleanup
- Fixed mDNS XML bug
- Session cleanup
- DRY refactor

---

## Support

If this adapter is useful to you, consider supporting its development:

[![PayPal](https://img.shields.io/badge/Donate-PayPal-blue.svg)](https://paypal.me/krobipd)

---

## License

MIT License - see [LICENSE](LICENSE)

Copyright (c) 2026 krobi <krobi@power-dreams.com>

---

*Developed with assistance from Claude.ai*
