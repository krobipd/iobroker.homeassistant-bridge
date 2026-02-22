'use strict';

const crypto = require('node:crypto');
const express = require('express');

// Emulated HA version — single source of truth
const HA_VERSION = '2024.1.0';

// Session TTL: 10 minutes
const SESSION_TTL_MS = 10 * 60 * 1000;

// Reusable login form schema
const LOGIN_SCHEMA = [
    { name: 'username', required: true, type: 'string' },
    { name: 'password', required: true, type: 'string' },
];

class WebServer {
    constructor(adapter, config) {
        this.adapter = adapter;
        this.config = config;
        this.app = express();
        this.server = null;
        this.sessions = new Map();
        this.connectedClients = 0;
        this.cleanupTimer = null;
    }

    /** @returns {string} Configured service name */
    get serviceName() {
        return this.config.serviceName || 'ioBroker';
    }

    // --- Helpers ---

    json(res, data, status = 200) {
        res.status(status).json(data);
    }

    /** Create a session entry with automatic expiration */
    createSession(key, data = {}) {
        this.sessions.set(key, { ...data, created: Date.now() });
        return key;
    }

    /** Periodic cleanup of expired sessions */
    cleanupSessions() {
        const now = Date.now();
        for (const [key, session] of this.sessions) {
            if (now - session.created > SESSION_TTL_MS) {
                this.sessions.delete(key);
            }
        }
    }

    // --- Middleware ---

    setupMiddleware() {
        this.app.use(express.json());
        this.app.use(express.urlencoded({ extended: true }));

        // Request logging — use debug level to keep production logs clean
        this.app.use((req, res, next) => {
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
                version: HA_VERSION,
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
                // WICHTIG: Immer true — Display muss Auth-Flow durchlaufen
                requires_api_password: true,
                uuid: '00000000-0000-0000-0000-000000000000',
                version: HA_VERSION,
            });
        });

        // Stub-Endpoints — HA-API-Kompatibilität
        for (const path of ['/api/states', '/api/services', '/api/events']) {
            this.app.get(path, (_req, res) => this.json(res, []));
        }
        this.app.get('/api/error_log', (_req, res) => this.json(res, ''));
    }

    setupAuthRoutes() {
        // Step 0: Auth providers
        // Immer homeassistant-Provider — Display erwartet 2-Schritt-Flow
        this.app.get('/auth/providers', (_req, res) => {
            this.json(res, [{
                name: 'Home Assistant Local',
                type: 'homeassistant',
                id: null,
            }]);
        });

        // Step 1: Initiate login flow → always return form
        this.app.post('/auth/login_flow', (_req, res) => {
            const flowId = crypto.randomUUID();
            this.createSession(flowId);
            this.adapter.log.debug(`Auth flow created: ${flowId}`);

            this.json(res, {
                type: 'form',
                flow_id: flowId,
                handler: ['homeassistant', null],
                step_id: 'init',
                data_schema: LOGIN_SCHEMA,
                description_placeholders: null,
                errors: null,
            });
        });

        // Step 2: Submit credentials
        this.app.post('/auth/login_flow/:flowId', (req, res) => {
            const { flowId } = req.params;

            if (!this.sessions.has(flowId)) {
                this.adapter.log.warn(`Unknown flow_id: ${flowId}`);
                return this.json(res, {
                    type: 'abort',
                    flow_id: flowId,
                    reason: 'unknown_flow',
                }, 400);
            }

            // Credentials prüfen wenn Auth aktiviert
            if (this.config.authRequired) {
                const { username, password } = req.body;
                if (username !== this.config.username || password !== this.config.password) {
                    this.adapter.log.warn('Invalid credentials');
                    return this.json(res, {
                        type: 'form',
                        flow_id: flowId,
                        handler: ['homeassistant', null],
                        step_id: 'init',
                        data_schema: LOGIN_SCHEMA,
                        errors: { base: 'invalid_auth' },
                        description_placeholders: null,
                    }, 400);
                }
            }

            // Auth OK — Code generieren
            this.sessions.delete(flowId);
            const code = crypto.randomUUID();
            this.createSession(code, { flowId });
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

            if (grant_type === 'authorization_code' && this.sessions.has(code)) {
                this.sessions.delete(code);
                this.connectedClients++;
                this.adapter.setStateAsync('info.clients', this.connectedClients, true);
                this.adapter.log.info('Display authenticated successfully');

                return this.json(res, {
                    access_token: crypto.randomUUID(),
                    token_type: 'Bearer',
                    refresh_token: crypto.randomUUID(),
                    expires_in: 1800,
                });
            }

            // Refresh token — einfach neuen Token ausgeben
            if (grant_type === 'refresh_token') {
                return this.json(res, {
                    access_token: crypto.randomUUID(),
                    token_type: 'Bearer',
                    expires_in: 1800,
                });
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
                clients: this.connectedClients,
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

    async start() {
        return new Promise((resolve, reject) => {
            this.setupMiddleware();
            this.setupRoutes();

            this.server = this.app.listen(this.config.port, () => {
                this.adapter.log.info(`Web server listening on port ${this.config.port}`);
                resolve();
            });

            this.server.on('error', (error) => {
                const msg = error.code === 'EADDRINUSE'
                    ? `Port ${this.config.port} is already in use!`
                    : `Server error: ${error.message}`;
                this.adapter.log.error(msg);
                reject(error);
            });

            // Session cleanup alle 5 Minuten
            this.cleanupTimer = setInterval(() => this.cleanupSessions(), 5 * 60 * 1000);
        });
    }

    async stop() {
        if (this.cleanupTimer) {
            clearInterval(this.cleanupTimer);
            this.cleanupTimer = null;
        }

        return new Promise((resolve) => {
            if (this.server) {
                this.server.close(() => {
                    this.adapter.log.info('Web server stopped');
                    this.server = null;
                    resolve();
                });
            } else {
                resolve();
            }
        });
    }
}

module.exports = WebServer;
