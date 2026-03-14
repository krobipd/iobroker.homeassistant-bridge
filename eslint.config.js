const js = require('@eslint/js');
const globals = require('globals');

module.exports = [
    js.configs.recommended,
    {
        languageOptions: {
            ecmaVersion: 2022,
            sourceType: 'commonjs',
            globals: {
                ...globals.node,
            },
        },
        rules: {
            'indent': ['error', 4, { 'SwitchCase': 1 }],
            'quotes': ['error', 'single', { 'avoidEscape': true }],
            'semi': ['error', 'always'],
            'no-unused-vars': ['error', { 'argsIgnorePattern': '^_' }],
            'no-console': 'off',
            'curly': ['error', 'all'],
            'brace-style': ['error', '1tbs'],
            'eqeqeq': ['error', 'always'],
            'no-var': 'error',
            'prefer-const': 'error',
            'no-multiple-empty-lines': ['error', { 'max': 1, 'maxEOF': 0 }],
            'comma-dangle': ['error', 'always-multiline'],
            'object-curly-spacing': ['error', 'always'],
            'array-bracket-spacing': ['error', 'never'],
            'space-before-blocks': 'error',
            'keyword-spacing': 'error',
        },
    },
    {
        ignores: [
            'node_modules/',
            '.git/',
        ],
    },
];
