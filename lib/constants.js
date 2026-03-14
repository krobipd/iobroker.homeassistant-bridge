'use strict';

/**
 * Shared constants for the homeassistant-bridge adapter
 */

// Emulated Home Assistant version (March 2026)
const HA_VERSION = '2026.3.1';

// Session TTL: 10 minutes
const SESSION_TTL_MS = 10 * 60 * 1000;

// Cleanup interval: 5 minutes
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000;

// Login form schema for Home Assistant auth flow
const LOGIN_SCHEMA = [
    { name: 'username', required: true, type: 'string' },
    { name: 'password', required: true, type: 'string' },
];

module.exports = {
    HA_VERSION,
    SESSION_TTL_MS,
    CLEANUP_INTERVAL_MS,
    LOGIN_SCHEMA,
};
