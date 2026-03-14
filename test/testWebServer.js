'use strict';

const { expect } = require('chai');
const http = require('node:http');
const WebServer = require('../lib/webserver');
const { HA_VERSION } = require('../lib/constants');

// Mock adapter for testing
function createMockAdapter() {
    return {
        log: {
            debug: () => {},
            info: () => {},
            warn: () => {},
            error: () => {},
        },
        setStateAsync: () => Promise.resolve(),
    };
}

// Helper to make HTTP requests
function httpRequest(options, body = null) {
    return new Promise((resolve, reject) => {
        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', (chunk) => (data += chunk));
            res.on('end', () => {
                try {
                    resolve({
                        statusCode: res.statusCode,
                        headers: res.headers,
                        body: data ? JSON.parse(data) : null,
                        rawBody: data,
                    });
                } catch {
                    resolve({
                        statusCode: res.statusCode,
                        headers: res.headers,
                        body: null,
                        rawBody: data,
                    });
                }
            });
        });
        req.on('error', reject);
        if (body) {
            req.write(typeof body === 'string' ? body : JSON.stringify(body));
        }
        req.end();
    });
}

describe('WebServer', () => {
    let server;
    let adapter;
    const TEST_PORT = 18123; // Use non-standard port for tests
    const config = {
        port: TEST_PORT,
        visUrl: 'http://example.com/vis',
        authRequired: false,
        username: 'admin',
        password: 'secret',
        mdnsEnabled: false,
        serviceName: 'TestServer',
    };

    before(async () => {
        adapter = createMockAdapter();
        server = new WebServer(adapter, config);
        await server.start();
    });

    after(async () => {
        await server.stop();
    });

    describe('constructor', () => {
        it('should generate a valid UUID', () => {
            expect(server.instanceUuid).to.match(
                /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
            );
        });

        it('should return configured service name', () => {
            expect(server.serviceName).to.equal('TestServer');
        });
    });

    describe('API endpoints', () => {
        it('GET /api/ should return API status', async () => {
            const res = await httpRequest({
                hostname: 'localhost',
                port: TEST_PORT,
                path: '/api/',
                method: 'GET',
            });

            expect(res.statusCode).to.equal(200);
            expect(res.body).to.deep.equal({ message: 'API running.' });
        });

        it('GET /api/config should return HA config', async () => {
            const res = await httpRequest({
                hostname: 'localhost',
                port: TEST_PORT,
                path: '/api/config',
                method: 'GET',
            });

            expect(res.statusCode).to.equal(200);
            expect(res.body.version).to.equal(HA_VERSION);
            expect(res.body.location_name).to.equal('TestServer');
            expect(res.body.unit_system.temperature).to.equal('°C');
        });

        it('GET /api/discovery_info should return discovery info', async () => {
            const res = await httpRequest({
                hostname: 'localhost',
                port: TEST_PORT,
                path: '/api/discovery_info',
                method: 'GET',
            });

            expect(res.statusCode).to.equal(200);
            expect(res.body.version).to.equal(HA_VERSION);
            expect(res.body.requires_api_password).to.be.true;
            expect(res.body.uuid).to.equal(server.instanceUuid);
        });

        it('GET /api/states should return empty array', async () => {
            const res = await httpRequest({
                hostname: 'localhost',
                port: TEST_PORT,
                path: '/api/states',
                method: 'GET',
            });

            expect(res.statusCode).to.equal(200);
            expect(res.body).to.deep.equal([]);
        });

        it('GET /api/services should return empty array', async () => {
            const res = await httpRequest({
                hostname: 'localhost',
                port: TEST_PORT,
                path: '/api/services',
                method: 'GET',
            });

            expect(res.statusCode).to.equal(200);
            expect(res.body).to.deep.equal([]);
        });

        it('GET /api/events should return empty array', async () => {
            const res = await httpRequest({
                hostname: 'localhost',
                port: TEST_PORT,
                path: '/api/events',
                method: 'GET',
            });

            expect(res.statusCode).to.equal(200);
            expect(res.body).to.deep.equal([]);
        });

        it('GET /api/error_log should return empty string', async () => {
            const res = await httpRequest({
                hostname: 'localhost',
                port: TEST_PORT,
                path: '/api/error_log',
                method: 'GET',
            });

            expect(res.statusCode).to.equal(200);
            expect(res.body).to.equal('');
        });
    });

    describe('Auth endpoints', () => {
        it('GET /auth/providers should return homeassistant provider', async () => {
            const res = await httpRequest({
                hostname: 'localhost',
                port: TEST_PORT,
                path: '/auth/providers',
                method: 'GET',
            });

            expect(res.statusCode).to.equal(200);
            expect(res.body).to.be.an('array').with.lengthOf(1);
            expect(res.body[0].type).to.equal('homeassistant');
        });

        it('POST /auth/login_flow should create a flow', async () => {
            const res = await httpRequest(
                {
                    hostname: 'localhost',
                    port: TEST_PORT,
                    path: '/auth/login_flow',
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                },
                {},
            );

            expect(res.statusCode).to.equal(200);
            expect(res.body.type).to.equal('form');
            expect(res.body.flow_id).to.match(
                /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
            );
            expect(res.body.step_id).to.equal('init');
        });

        it('POST /auth/login_flow/:flowId with unknown flow should return error', async () => {
            const res = await httpRequest(
                {
                    hostname: 'localhost',
                    port: TEST_PORT,
                    path: '/auth/login_flow/unknown-flow-id',
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                },
                { username: 'admin', password: 'secret' },
            );

            expect(res.statusCode).to.equal(400);
            expect(res.body.type).to.equal('abort');
            expect(res.body.reason).to.equal('unknown_flow');
        });

        it('should complete full auth flow', async () => {
            // Step 1: Create flow
            const flowRes = await httpRequest(
                {
                    hostname: 'localhost',
                    port: TEST_PORT,
                    path: '/auth/login_flow',
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                },
                {},
            );
            expect(flowRes.statusCode).to.equal(200);
            const flowId = flowRes.body.flow_id;

            // Step 2: Submit credentials
            const credRes = await httpRequest(
                {
                    hostname: 'localhost',
                    port: TEST_PORT,
                    path: `/auth/login_flow/${flowId}`,
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                },
                { username: 'admin', password: 'secret' },
            );
            expect(credRes.statusCode).to.equal(200);
            expect(credRes.body.type).to.equal('create_entry');
            const code = credRes.body.result;

            // Step 3: Exchange code for token
            const tokenRes = await httpRequest(
                {
                    hostname: 'localhost',
                    port: TEST_PORT,
                    path: '/auth/token',
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                },
                `grant_type=authorization_code&code=${code}`,
            );
            expect(tokenRes.statusCode).to.equal(200);
            expect(tokenRes.body.access_token).to.exist;
            expect(tokenRes.body.token_type).to.equal('Bearer');
            expect(tokenRes.body.refresh_token).to.exist;
        });

        it('POST /auth/token with refresh_token should return new token', async () => {
            const res = await httpRequest(
                {
                    hostname: 'localhost',
                    port: TEST_PORT,
                    path: '/auth/token',
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                },
                'grant_type=refresh_token&refresh_token=some-token',
            );

            expect(res.statusCode).to.equal(200);
            expect(res.body.access_token).to.exist;
            expect(res.body.token_type).to.equal('Bearer');
        });
    });

    describe('Misc endpoints', () => {
        it('GET /health should return health status', async () => {
            const res = await httpRequest({
                hostname: 'localhost',
                port: TEST_PORT,
                path: '/health',
                method: 'GET',
            });

            expect(res.statusCode).to.equal(200);
            expect(res.body.status).to.equal('ok');
            expect(res.body.adapter).to.equal('homeassistant-bridge');
            expect(res.body.version).to.equal(HA_VERSION);
        });

        it('GET /manifest.json should return PWA manifest', async () => {
            const res = await httpRequest({
                hostname: 'localhost',
                port: TEST_PORT,
                path: '/manifest.json',
                method: 'GET',
            });

            expect(res.statusCode).to.equal(200);
            expect(res.body.name).to.equal('TestServer');
            expect(res.body.display).to.equal('standalone');
        });

        it('GET / should redirect to visUrl', async () => {
            const res = await httpRequest({
                hostname: 'localhost',
                port: TEST_PORT,
                path: '/',
                method: 'GET',
            });

            expect(res.statusCode).to.equal(302);
            expect(res.headers.location).to.equal('http://example.com/vis');
        });

        it('GET /unknown should return 404', async () => {
            const res = await httpRequest({
                hostname: 'localhost',
                port: TEST_PORT,
                path: '/unknown/path',
                method: 'GET',
            });

            expect(res.statusCode).to.equal(404);
            expect(res.body.error).to.equal('Not Found');
        });
    });

    describe('Session management', () => {
        it('should cleanup expired sessions', async () => {
            // Clear any existing sessions from previous tests
            server.sessions.clear();

            // Create a session manually with old timestamp
            server.sessions.set('old-session', { created: Date.now() - 20 * 60 * 1000 });
            server.sessions.set('new-session', { created: Date.now() });

            expect(server.sessions.size).to.equal(2);

            server.cleanupSessions();

            expect(server.sessions.size).to.equal(1);
            expect(server.sessions.has('new-session')).to.be.true;
            expect(server.sessions.has('old-session')).to.be.false;
        });
    });
});

describe('WebServer without visUrl', () => {
    let server;
    let adapter;
    const TEST_PORT = 18124;

    before(async () => {
        adapter = createMockAdapter();
        server = new WebServer(adapter, {
            port: TEST_PORT,
            visUrl: '', // No redirect URL configured
            authRequired: false,
            serviceName: 'TestServer',
        });
        await server.start();
    });

    after(async () => {
        await server.stop();
    });

    it('GET / should return error when visUrl not configured', async () => {
        const res = await httpRequest({
            hostname: 'localhost',
            port: TEST_PORT,
            path: '/',
            method: 'GET',
        });

        expect(res.statusCode).to.equal(500);
        expect(res.body.error).to.equal('No redirect URL configured');
    });
});

describe('WebServer with auth required', () => {
    let server;
    let adapter;
    const TEST_PORT = 18125;

    before(async () => {
        adapter = createMockAdapter();
        server = new WebServer(adapter, {
            port: TEST_PORT,
            visUrl: 'http://example.com',
            authRequired: true,
            username: 'testuser',
            password: 'testpass',
            serviceName: 'AuthServer',
        });
        await server.start();
    });

    after(async () => {
        await server.stop();
    });

    it('should reject invalid credentials', async () => {
        // Create flow
        const flowRes = await httpRequest(
            {
                hostname: 'localhost',
                port: TEST_PORT,
                path: '/auth/login_flow',
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
            },
            {},
        );
        const flowId = flowRes.body.flow_id;

        // Submit wrong credentials
        const res = await httpRequest(
            {
                hostname: 'localhost',
                port: TEST_PORT,
                path: `/auth/login_flow/${flowId}`,
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
            },
            { username: 'wrong', password: 'wrong' },
        );

        expect(res.statusCode).to.equal(400);
        expect(res.body.errors.base).to.equal('invalid_auth');
    });

    it('should accept valid credentials', async () => {
        // Create flow
        const flowRes = await httpRequest(
            {
                hostname: 'localhost',
                port: TEST_PORT,
                path: '/auth/login_flow',
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
            },
            {},
        );
        const flowId = flowRes.body.flow_id;

        // Submit correct credentials
        const res = await httpRequest(
            {
                hostname: 'localhost',
                port: TEST_PORT,
                path: `/auth/login_flow/${flowId}`,
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
            },
            { username: 'testuser', password: 'testpass' },
        );

        expect(res.statusCode).to.equal(200);
        expect(res.body.type).to.equal('create_entry');
    });
});
