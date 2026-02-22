'use strict';

const crypto = require('node:crypto');
const fs = require('node:fs');
const os = require('node:os');
const { execSync } = require('node:child_process');

const AVAHI_SERVICE_DIR = '/etc/avahi/services';
const AVAHI_SERVICE_FILE = `${AVAHI_SERVICE_DIR}/homeassistant-bridge.service`;

class MDNSService {
    constructor(adapter, config) {
        this.adapter = adapter;
        this.config = config;
        this.uuid = crypto.randomUUID();
        this.active = false;
    }

    /** First non-internal IPv4 address */
    getLocalIP() {
        const interfaces = os.networkInterfaces();
        for (const ifaces of Object.values(interfaces)) {
            for (const iface of ifaces) {
                if (iface.family === 'IPv4' && !iface.internal) {
                    return iface.address;
                }
            }
        }
        return '127.0.0.1';
    }

    /** Check if avahi-daemon is running */
    isAvahiRunning() {
        for (const cmd of ['systemctl is-active avahi-daemon', 'pgrep avahi-daemon']) {
            try {
                execSync(cmd, { stdio: 'ignore' });
                return true;
            } catch { /* try next */ }
        }
        return false;
    }

    /** Build Avahi service XML */
    buildServiceXml(serviceName, port, baseUrl) {
        return [
            '<?xml version="1.0" standalone=\'no\'?>',
            '<!DOCTYPE service-group SYSTEM "avahi-service.dtd">',
            '<service-group>',
            `  <name replace-wildcards="yes">${serviceName}</name>`,
            '  <service protocol="ipv4">',
            '    <type>_home-assistant._tcp</type>',
            `    <port>${port}</port>`,
            `    <txt-record>base_url=${baseUrl}</txt-record>`,
            `    <txt-record>internal_url=${baseUrl}</txt-record>`,
            '    <txt-record>external_url=</txt-record>',
            '    <txt-record>version=2024.1.0</txt-record>',
            `    <txt-record>uuid=${this.uuid}</txt-record>`,
            `    <txt-record>location_name=${serviceName}</txt-record>`,
            '    <txt-record>requires_api_password=True</txt-record>',
            '  </service>',
            '</service-group>',
        ].join('\n');
    }

    /** Reload avahi-daemon to pick up the new service file */
    reloadAvahi() {
        try {
            execSync('avahi-daemon --reload 2>/dev/null || kill -HUP $(pgrep avahi-daemon)', {
                stdio: 'ignore',
                shell: true,
            });
        } catch { /* non-critical — avahi polls service dir anyway */ }
    }

    start() {
        if (!this.isAvahiRunning()) {
            this.adapter.log.error('mDNS: Avahi daemon is not running!');
            this.adapter.log.error('mDNS: Install: sudo apt install avahi-daemon && sudo systemctl enable --now avahi-daemon');
            this.adapter.log.error('mDNS: Permission: sudo chown iobroker /etc/avahi/services');
            this.adapter.log.warn(`mDNS: Fallback: enter http://YOUR_IP:${this.config.port} on the display`);
            return;
        }

        const localIP = this.getLocalIP();
        const baseUrl = `http://${localIP}:${this.config.port}`;
        const serviceName = this.config.serviceName || 'ioBroker';

        try {
            const serviceXml = this.buildServiceXml(serviceName, this.config.port, baseUrl);

            if (!fs.existsSync(AVAHI_SERVICE_DIR)) {
                fs.mkdirSync(AVAHI_SERVICE_DIR, { recursive: true });
            }

            fs.writeFileSync(AVAHI_SERVICE_FILE, serviceXml, 'utf8');
            this.active = true;
            this.reloadAvahi();

            this.adapter.log.info(`mDNS: Broadcasting ${serviceName}._home-assistant._tcp.local on ${localIP}:${this.config.port}`);
            this.adapter.log.info(`mDNS: UUID: ${this.uuid}`);
            this.adapter.log.info('mDNS: Verify: avahi-browse _home-assistant._tcp -r -t');
        } catch (error) {
            this.adapter.log.error(`mDNS: Failed to write service file: ${error.message}`);
            if (error.code === 'EACCES') {
                this.adapter.log.error('mDNS: Permission denied — run: sudo chown iobroker /etc/avahi/services');
            }
        }
    }

    stop() {
        if (!this.active) return;

        try {
            if (fs.existsSync(AVAHI_SERVICE_FILE)) {
                fs.unlinkSync(AVAHI_SERVICE_FILE);
                this.reloadAvahi();
                this.adapter.log.info('mDNS: Service file removed');
            }
        } catch (error) {
            this.adapter.log.warn(`mDNS: Could not remove service file: ${error.message}`);
        }

        this.active = false;
    }
}

module.exports = MDNSService;
