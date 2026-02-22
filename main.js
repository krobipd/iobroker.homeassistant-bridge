'use strict';

const utils = require('@iobroker/adapter-core');
const MDNSService = require('./lib/mdns');
const WebServer = require('./lib/webserver');

class HomeAssistantBridge extends utils.Adapter {
    constructor(options) {
        super({
            ...options,
            name: 'homeassistant-bridge',
        });

        this.mdnsService = null;
        this.webServer = null;
        this.on('ready', this.onReady.bind(this));
        this.on('unload', this.onUnload.bind(this));
    }

    async onReady() {
        this.log.info('Starting Home Assistant Bridge...');

        try {
            await this.setStateAsync('info.connection', false, true);
            await this.setStateAsync('info.clients', 0, true);

            const config = {
                port:         this.config.port || 8123,
                visUrl:       this.config.visUrl || 'http://localhost:8082/vis/',
                authRequired: this.config.authRequired === true,
                username:     this.config.username || 'admin',
                password:     this.config.password || '',
                mdnsEnabled:  this.config.mdnsEnabled !== false,
                serviceName:  this.config.serviceName || 'ioBroker',
            };

            this.log.info(`Config: port=${config.port}, auth=${config.authRequired}, mdns=${config.mdnsEnabled}`);
            this.log.info(`Target URL: ${config.visUrl}`);

            if (/\blocalhost\b|127\.0\.0\.1/.test(config.visUrl)) {
                this.log.warn('visUrl contains localhost — the display cannot reach this! Use the real IP address.');
            }

            this.webServer = new WebServer(this, config);
            await this.webServer.start();

            if (config.mdnsEnabled) {
                this.mdnsService = new MDNSService(this, config);
                this.mdnsService.start();
            } else {
                this.log.info('mDNS disabled — enter URL manually on the display');
            }

            await this.setStateAsync('info.connection', true, true);
            this.log.info('Home Assistant Bridge running');
        } catch (error) {
            this.log.error(`Failed to start: ${error.message}`);
            this.log.error(error.stack);
        }
    }

    async onUnload(callback) {
        try {
            this.log.info('Shutting down...');

            if (this.mdnsService) {
                this.mdnsService.stop();
                this.mdnsService = null;
            }

            if (this.webServer) {
                await this.webServer.stop();
                this.webServer = null;
            }

            await this.setStateAsync('info.connection', false, true);
            this.log.info('Home Assistant Bridge stopped');
        } catch (e) {
            this.log.error(`Shutdown error: ${e.message}`);
        } finally {
            callback();
        }
    }
}

if (require.main !== module) {
    module.exports = (options) => new HomeAssistantBridge(options);
} else {
    new HomeAssistantBridge();
}
