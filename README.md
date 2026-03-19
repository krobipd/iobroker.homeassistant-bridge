# ioBroker.homeassistant-bridge

[![npm version](https://img.shields.io/npm/v/iobroker.homeassistant-bridge)](https://www.npmjs.com/package/iobroker.homeassistant-bridge)
![Node](https://img.shields.io/badge/node-%3E%3D20-brightgreen)
![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)
[![npm downloads](https://img.shields.io/npm/dt/iobroker.homeassistant-bridge)](https://www.npmjs.com/package/iobroker.homeassistant-bridge)
![Installations](https://iobroker.live/badges/homeassistant-bridge-installed.svg)
[![PayPal](https://img.shields.io/badge/Donate-PayPal-blue.svg)](https://paypal.me/krobipd)

<img src="https://raw.githubusercontent.com/krobipd/ioBroker.homeassistant-bridge/main/admin/homeassistant-bridge.svg" width="100" />

Emulates a minimal Home Assistant server so that devices like the **Shelly Wall Display XL** can be redirected to any custom web URL — without running a real Home Assistant Core.

---

## Features

- **Home Assistant Emulation** — minimal HA API compatible with Shelly Wall Display XL
- **mDNS Discovery** — automatic detection via Avahi (`_home-assistant._tcp`)
- **OAuth2-like Auth Flow** — full login flow emulation, optional credential validation
- **Flexible Redirect** — send the display to any ioBroker VIS, VIS-2, or custom web URL
- **Modern Admin UI** — JSON-Config for easy configuration

---

## Requirements

- **Node.js >= 20**
- **ioBroker js-controller >= 7.0.0**
- **ioBroker Admin >= 7.6.20**
- Linux system with Avahi (for mDNS)

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

## Troubleshooting

### Display cannot find the server (mDNS)

The adapter registers a `_home-assistant._tcp` service via Avahi. Automatic discovery did not work reliably in tests — manual configuration is more stable:

```
IP:   <ioBroker-IP>
Port: 8123
```


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

## Changelog

### 0.8.4 (2026-03-19)
- Logging cleanup: auth flow, redirect and config details moved to debug; remove redundant start/stop messages

### 0.8.3 (2026-03-18)
- Remove unused `info.clients` state and dead code cleanup

### 0.8.2 (2026-03-17)
- Migrate to @alcalzone/release-script, enable npm Trusted Publishing

### 0.8.1 (2026-03-16)
- Fix automated release pipeline (remove legacy ci.yml and release.yml workflows)

### 0.8.0 (2026-03-16)
- ioBroker repository compliance: official testing actions, all translations, donation link

Older changelog: [CHANGELOG.md](CHANGELOG.md)

---

## Support

- [ioBroker Forum](https://forum.iobroker.net/)
- [GitHub Issues](https://github.com/krobipd/ioBroker.homeassistant-bridge/issues)

If this adapter is useful to you, consider supporting its development via the PayPal badge at the top of this page.

---

## License

MIT License - see [LICENSE](LICENSE)

Copyright (c) 2026 krobi <krobi@power-dreams.com>

---

*Developed with assistance from Claude.ai*
