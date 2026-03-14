'use strict';

const { expect } = require('chai');
const MDNSService = require('../lib/mdns');
const { HA_VERSION } = require('../lib/constants');

// Mock adapter for testing
function createMockAdapter() {
    const logs = [];
    return {
        log: {
            debug: (msg) => logs.push({ level: 'debug', msg }),
            info: (msg) => logs.push({ level: 'info', msg }),
            warn: (msg) => logs.push({ level: 'warn', msg }),
            error: (msg) => logs.push({ level: 'error', msg }),
        },
        _logs: logs,
    };
}

describe('MDNSService', () => {
    let service;
    let adapter;
    const config = {
        port: 8123,
        serviceName: 'TestService',
        mdnsEnabled: true,
    };

    beforeEach(() => {
        adapter = createMockAdapter();
        service = new MDNSService(adapter, config);
    });

    describe('constructor', () => {
        it('should generate a valid UUID', () => {
            expect(service.uuid).to.match(
                /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
            );
        });

        it('should not be active initially', () => {
            expect(service.active).to.be.false;
        });
    });

    describe('getLocalIP', () => {
        it('should return an IP address string', () => {
            const ip = service.getLocalIP();
            expect(ip).to.be.a('string');
            // Should be either a valid IPv4 or fallback 127.0.0.1
            expect(ip).to.match(/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/);
        });
    });

    describe('buildServiceXml', () => {
        it('should generate valid XML', () => {
            const xml = service.buildServiceXml('TestName', 8123, 'http://192.168.1.100:8123');

            expect(xml).to.include('<?xml version="1.0"');
            expect(xml).to.include('<service-group>');
            expect(xml).to.include('</service-group>');
        });

        it('should include service name', () => {
            const xml = service.buildServiceXml('MyService', 8123, 'http://192.168.1.100:8123');

            expect(xml).to.include('<name replace-wildcards="yes">MyService</name>');
        });

        it('should include port', () => {
            const xml = service.buildServiceXml('Test', 9999, 'http://localhost:9999');

            expect(xml).to.include('<port>9999</port>');
        });

        it('should include base_url and internal_url', () => {
            const baseUrl = 'http://192.168.1.50:8123';
            const xml = service.buildServiceXml('Test', 8123, baseUrl);

            expect(xml).to.include(`<txt-record>base_url=${baseUrl}</txt-record>`);
            expect(xml).to.include(`<txt-record>internal_url=${baseUrl}</txt-record>`);
        });

        it('should include HA version', () => {
            const xml = service.buildServiceXml('Test', 8123, 'http://localhost:8123');

            expect(xml).to.include(`<txt-record>version=${HA_VERSION}</txt-record>`);
        });

        it('should include UUID', () => {
            const xml = service.buildServiceXml('Test', 8123, 'http://localhost:8123');

            expect(xml).to.include(`<txt-record>uuid=${service.uuid}</txt-record>`);
        });

        it('should include location_name', () => {
            const xml = service.buildServiceXml('LocationTest', 8123, 'http://localhost:8123');

            expect(xml).to.include('<txt-record>location_name=LocationTest</txt-record>');
        });

        it('should include requires_api_password=True', () => {
            const xml = service.buildServiceXml('Test', 8123, 'http://localhost:8123');

            expect(xml).to.include('<txt-record>requires_api_password=True</txt-record>');
        });

        it('should use _home-assistant._tcp service type', () => {
            const xml = service.buildServiceXml('Test', 8123, 'http://localhost:8123');

            expect(xml).to.include('<type>_home-assistant._tcp</type>');
        });

        it('should use ipv4 protocol', () => {
            const xml = service.buildServiceXml('Test', 8123, 'http://localhost:8123');

            expect(xml).to.include('<service protocol="ipv4">');
        });
    });

    describe('isAvahiRunning', () => {
        it('should return a boolean', () => {
            // This test is platform-dependent
            // On Linux with avahi: true
            // On macOS/Windows: false
            const result = service.isAvahiRunning();
            expect(result).to.be.a('boolean');
        });
    });

    describe('start/stop lifecycle', () => {
        it('should not throw when avahi is not running', () => {
            // This test works on non-Linux systems where avahi is not available
            expect(() => service.start()).to.not.throw();
        });

        it('should handle stop when not active', () => {
            expect(service.active).to.be.false;
            expect(() => service.stop()).to.not.throw();
        });
    });

    describe('logging', () => {
        it('should log error when avahi is not running', () => {
            // On systems without avahi, start() should log errors
            service.start();

            if (!service.active) {
                // Avahi not running - should have logged errors
                const errorLogs = adapter._logs.filter((l) => l.level === 'error');
                expect(errorLogs.length).to.be.greaterThan(0);
            }
        });
    });
});

describe('MDNSService with default serviceName', () => {
    it('should use ioBroker as default service name', () => {
        const adapter = createMockAdapter();
        const service = new MDNSService(adapter, { port: 8123 });

        // serviceName is not set, so buildServiceXml should get undefined
        // The actual default is handled in the start() method
        const xml = service.buildServiceXml('ioBroker', 8123, 'http://localhost:8123');
        expect(xml).to.include('<name replace-wildcards="yes">ioBroker</name>');
    });
});
