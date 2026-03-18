import * as utils from '@iobroker/adapter-core';
import { MDNSService } from './lib/mdns';
import { WebServer } from './lib/webserver';
import type { AdapterConfig } from './lib/types';

/** Native adapter configuration from io-package.json */
interface NativeConfig {
    port: number;
    bindAddress: string;
    visUrl: string;
    authRequired: boolean;
    username: string;
    password: string;
    mdnsEnabled: boolean;
    serviceName: string;
}

class HomeAssistantBridge extends utils.Adapter {
    private mdnsService: MDNSService | null = null;
    private webServer: WebServer | null = null;

    declare config: NativeConfig;

    public constructor(options: Partial<utils.AdapterOptions> = {}) {
        super({
            ...options,
            name: 'homeassistant-bridge',
        });

        this.on('ready', this.onReady.bind(this));
        this.on('unload', this.onUnload.bind(this));
    }

    private async onReady(): Promise<void> {
        this.log.info('Starting Home Assistant Bridge...');

        try {
            await this.setStateAsync('info.connection', false, true);

            // Validate configuration
            if (!this.config.visUrl) {
                this.log.error('No redirect URL configured! Please configure a URL in the adapter settings.');
            }

            const config: AdapterConfig = {
                port: this.config.port || 8123,
                bindAddress: this.config.bindAddress || '0.0.0.0',
                visUrl: this.config.visUrl || '',
                authRequired: this.config.authRequired === true,
                username: this.config.username || 'admin',
                password: this.config.password || '',
                mdnsEnabled: this.config.mdnsEnabled !== false,
                serviceName: this.config.serviceName || 'ioBroker',
            };

            this.log.info(`Config: port=${config.port}, auth=${config.authRequired}, mdns=${config.mdnsEnabled}`);

            if (config.visUrl) {
                this.log.info(`Target URL: ${config.visUrl}`);

                if (/\blocalhost\b|127\.0\.0\.1/.test(config.visUrl)) {
                    this.log.warn(
                        'visUrl contains localhost — the display cannot reach this! Use the real IP address.',
                    );
                }
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
            const err = error as Error;
            this.log.error(`Failed to start: ${err.message}`);
            if (err.stack) {
                this.log.debug(err.stack);
            }
        }
    }

    private async onUnload(callback: () => void): Promise<void> {
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
        } catch (error) {
            const err = error as Error;
            this.log.error(`Shutdown error: ${err.message}`);
        } finally {
            callback();
        }
    }
}

if (require.main !== module) {
    // Export the constructor in compact mode
    module.exports = (options: Partial<utils.AdapterOptions> | undefined) => new HomeAssistantBridge(options);
} else {
    // Otherwise start the instance directly
    (() => new HomeAssistantBridge())();
}
