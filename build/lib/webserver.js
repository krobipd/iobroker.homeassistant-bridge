"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WebServer = void 0;
const node_crypto_1 = __importDefault(require("node:crypto"));
const express_1 = __importDefault(require("express"));
const constants_1 = require("./constants");
/** Express web server emulating Home Assistant API */
class WebServer {
    adapter;
    config;
    app;
    server = null;
    sessions = new Map();
    cleanupTimer = null;
    instanceUuid;
    /**
     * Creates a new WebServer instance
     *
     * @param adapter - Adapter interface for logging and state management
     * @param config - Adapter configuration
     */
    constructor(adapter, config) {
        this.adapter = adapter;
        this.config = config;
        this.app = (0, express_1.default)();
        this.instanceUuid = node_crypto_1.default.randomUUID();
    }
    /** Configured service name */
    get serviceName() {
        return this.config.serviceName || 'ioBroker';
    }
    /** Returns the actual address the server is bound to, or null if not running */
    get boundAddress() {
        if (!this.server) {
            return null;
        }
        const addr = this.server.address();
        if (typeof addr === 'string' || !addr) {
            return null;
        }
        return { address: addr.address, port: addr.port };
    }
    // --- Helpers ---
    json(res, data, status = 200) {
        res.status(status).json(data);
    }
    /**
     * Create a session entry with automatic expiration
     *
     * @param key - Unique session identifier
     */
    createSession(key) {
        this.sessions.set(key, { created: Date.now() });
    }
    /** Periodic cleanup of expired sessions */
    cleanupSessions() {
        const now = Date.now();
        let cleaned = 0;
        for (const [key, session] of this.sessions) {
            if (now - session.created > constants_1.SESSION_TTL_MS) {
                this.sessions.delete(key);
                cleaned++;
            }
        }
        if (cleaned > 0) {
            this.adapter.log.debug(`Session cleanup: removed ${cleaned} expired sessions`);
        }
    }
    // --- Middleware ---
    setupMiddleware() {
        this.app.use(express_1.default.json());
        this.app.use(express_1.default.urlencoded({ extended: true }));
        // Request logging — use debug level to keep production logs clean
        this.app.use((req, _res, next) => {
            this.adapter.log.debug(`${req.method} ${req.path}`);
            next();
        });
    }
    // --- Routes ---
    setupRoutes() {
        this.setupApiRoutes();
        this.setupAuthRoutes();
        this.setupMiscRoutes();
        this.setupCatchAll();
    }
    setupApiRoutes() {
        // CRITICAL: trailing slash — Shelly checks this endpoint for discovery
        this.app.get('/api/', (_req, res) => {
            this.json(res, { message: 'API running.' });
        });
        this.app.get('/api/config', (_req, res) => {
            this.json(res, {
                components: ['http', 'api', 'frontend', 'homeassistant'],
                config_dir: '/config',
                elevation: 0,
                latitude: 0,
                longitude: 0,
                location_name: this.serviceName,
                time_zone: 'UTC',
                unit_system: { length: 'km', mass: 'g', temperature: '°C', volume: 'L' },
                version: constants_1.HA_VERSION,
                whitelist_external_dirs: [],
            });
        });
        this.app.get('/api/discovery_info', (req, res) => {
            const baseUrl = `http://${req.hostname}:${this.config.port}`;
            this.json(res, {
                base_url: baseUrl,
                external_url: null,
                internal_url: baseUrl,
                location_name: this.serviceName,
                requires_api_password: true,
                uuid: this.instanceUuid,
                version: constants_1.HA_VERSION,
            });
        });
        // Stub-Endpoints for HA-API compatibility
        for (const path of ['/api/states', '/api/services', '/api/events']) {
            this.app.get(path, (_req, res) => this.json(res, []));
        }
        this.app.get('/api/error_log', (_req, res) => this.json(res, ''));
    }
    setupAuthRoutes() {
        // Step 0: Auth providers
        this.app.get('/auth/providers', (_req, res) => {
            this.json(res, [
                {
                    name: 'Home Assistant Local',
                    type: 'homeassistant',
                    id: null,
                },
            ]);
        });
        // Step 1: Initiate login flow
        this.app.post('/auth/login_flow', (_req, res) => {
            const flowId = node_crypto_1.default.randomUUID();
            this.createSession(flowId);
            this.adapter.log.debug(`Auth flow created: ${flowId}`);
            this.json(res, {
                type: 'form',
                flow_id: flowId,
                handler: ['homeassistant', null],
                step_id: 'init',
                data_schema: constants_1.LOGIN_SCHEMA,
                description_placeholders: null,
                errors: null,
            });
        });
        // Step 2: Submit credentials
        this.app.post('/auth/login_flow/:flowId', (req, res) => {
            const flowId = req.params.flowId;
            if (!this.sessions.has(flowId)) {
                this.adapter.log.warn(`Unknown flow_id: ${flowId}`);
                this.json(res, {
                    type: 'abort',
                    flow_id: flowId,
                    reason: 'unknown_flow',
                }, 400);
                return;
            }
            // Validate credentials if auth is enabled
            if (this.config.authRequired) {
                const { username, password } = req.body;
                if (username !== this.config.username || password !== this.config.password) {
                    this.adapter.log.warn('Invalid credentials');
                    this.json(res, {
                        type: 'form',
                        flow_id: flowId,
                        handler: ['homeassistant', null],
                        step_id: 'init',
                        data_schema: constants_1.LOGIN_SCHEMA,
                        errors: { base: 'invalid_auth' },
                        description_placeholders: null,
                    }, 400);
                    return;
                }
            }
            // Auth OK — generate code
            this.sessions.delete(flowId);
            const code = node_crypto_1.default.randomUUID();
            this.createSession(code);
            this.adapter.log.info('Auth flow completed — code issued');
            this.json(res, {
                version: 1,
                type: 'create_entry',
                flow_id: flowId,
                handler: ['homeassistant', null],
                result: code,
                description: null,
                description_placeholders: null,
            });
        });
        // Step 3: Exchange code for token
        this.app.post('/auth/token', (req, res) => {
            const { code, grant_type } = req.body;
            if (grant_type === 'authorization_code' && code && this.sessions.has(code)) {
                this.sessions.delete(code);
                this.adapter.log.info('Display authenticated successfully');
                this.json(res, {
                    access_token: node_crypto_1.default.randomUUID(),
                    token_type: 'Bearer',
                    refresh_token: node_crypto_1.default.randomUUID(),
                    expires_in: 1800,
                });
                return;
            }
            // Refresh token — issue new token
            if (grant_type === 'refresh_token') {
                this.json(res, {
                    access_token: node_crypto_1.default.randomUUID(),
                    token_type: 'Bearer',
                    expires_in: 1800,
                });
                return;
            }
            this.adapter.log.warn(`Token exchange failed: grant_type=${grant_type}`);
            this.json(res, {
                error: 'invalid_request',
                error_description: 'Invalid or expired code',
            }, 400);
        });
    }
    setupMiscRoutes() {
        this.app.get('/health', (_req, res) => {
            this.json(res, {
                status: 'ok',
                adapter: 'homeassistant-bridge',
                version: constants_1.HA_VERSION,
                config: {
                    mdns: this.config.mdnsEnabled,
                    auth: this.config.authRequired,
                    redirectTo: this.config.visUrl,
                },
            });
        });
        this.app.get('/manifest.json', (_req, res) => {
            this.json(res, {
                name: this.serviceName,
                short_name: this.serviceName,
                start_url: '/',
                display: 'standalone',
                background_color: '#ffffff',
                theme_color: '#03a9f4',
            });
        });
        // Redirect — Display WebView follows 302 natively
        this.app.get('/', (_req, res) => {
            if (!this.config.visUrl) {
                this.adapter.log.error('No redirect URL configured!');
                this.json(res, {
                    error: 'No redirect URL configured',
                    message: 'Please configure a redirect URL in the adapter settings.',
                }, 500);
                return;
            }
            this.adapter.log.info(`Redirecting to: ${this.config.visUrl}`);
            res.redirect(this.config.visUrl);
        });
    }
    setupCatchAll() {
        this.app.use((req, res) => {
            this.adapter.log.debug(`404: ${req.method} ${req.path}`);
            this.json(res, { error: 'Not Found', path: req.path }, 404);
        });
    }
    // --- Lifecycle ---
    /** Start the web server and session cleanup timer */
    async start() {
        return new Promise((resolve, reject) => {
            this.setupMiddleware();
            this.setupRoutes();
            const bindAddress = this.config.bindAddress || '0.0.0.0';
            this.server = this.app.listen(this.config.port, bindAddress, () => {
                this.adapter.log.info(`Web server listening on ${bindAddress}:${this.config.port}`);
                resolve();
            });
            this.server.on('error', (error) => {
                const msg = error.code === 'EADDRINUSE'
                    ? `Port ${this.config.port} is already in use!`
                    : `Server error: ${error.message}`;
                this.adapter.log.error(msg);
                reject(error);
            });
            // Session cleanup timer
            this.cleanupTimer = setInterval(() => this.cleanupSessions(), constants_1.CLEANUP_INTERVAL_MS);
        });
    }
    /** Stop the web server and cleanup timer */
    async stop() {
        if (this.cleanupTimer) {
            clearInterval(this.cleanupTimer);
            this.cleanupTimer = null;
        }
        return new Promise(resolve => {
            if (this.server) {
                this.server.close(() => {
                    this.adapter.log.info('Web server stopped');
                    this.server = null;
                    resolve();
                });
            }
            else {
                resolve();
            }
        });
    }
}
exports.WebServer = WebServer;
