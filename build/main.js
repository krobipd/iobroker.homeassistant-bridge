"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const utils = __importStar(require("@iobroker/adapter-core"));
const mdns_1 = require("./lib/mdns");
const webserver_1 = require("./lib/webserver");
class HomeAssistantBridge extends utils.Adapter {
    mdnsService = null;
    webServer = null;
    constructor(options = {}) {
        super({
            ...options,
            name: 'homeassistant-bridge',
        });
        this.on('ready', this.onReady.bind(this));
        this.on('unload', this.onUnload.bind(this));
    }
    async onReady() {
        try {
            await this.setStateAsync('info.connection', false, true);
            // Validate configuration
            if (!this.config.visUrl) {
                this.log.error('No redirect URL configured! Please configure a URL in the adapter settings.');
            }
            const config = {
                port: this.config.port || 8123,
                bindAddress: this.config.bindAddress || '0.0.0.0',
                visUrl: this.config.visUrl || '',
                authRequired: this.config.authRequired === true,
                username: this.config.username || 'admin',
                password: this.config.password || '',
                mdnsEnabled: this.config.mdnsEnabled !== false,
                serviceName: this.config.serviceName || 'ioBroker',
            };
            this.log.debug(`Config: port=${config.port}, auth=${config.authRequired}, mdns=${config.mdnsEnabled}`);
            if (config.visUrl) {
                this.log.debug(`Target URL: ${config.visUrl}`);
                if (/\blocalhost\b|127\.0\.0\.1/.test(config.visUrl)) {
                    this.log.warn('visUrl contains localhost — the display cannot reach this! Use the real IP address.');
                }
            }
            this.webServer = new webserver_1.WebServer(this, config);
            await this.webServer.start();
            if (config.mdnsEnabled) {
                this.mdnsService = new mdns_1.MDNSService(this, config);
                this.mdnsService.start();
            }
            else {
                this.log.debug('mDNS disabled — enter URL manually on the display');
            }
            await this.setStateAsync('info.connection', true, true);
            this.log.info('Home Assistant Bridge running');
        }
        catch (error) {
            const err = error;
            this.log.error(`Failed to start: ${err.message}`);
            if (err.stack) {
                this.log.debug(err.stack);
            }
        }
    }
    async onUnload(callback) {
        try {
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
        }
        catch (error) {
            const err = error;
            this.log.error(`Shutdown error: ${err.message}`);
        }
        finally {
            callback();
        }
    }
}
if (require.main !== module) {
    // Export the constructor in compact mode
    module.exports = (options) => new HomeAssistantBridge(options);
}
else {
    // Otherwise start the instance directly
    (() => new HomeAssistantBridge())();
}
