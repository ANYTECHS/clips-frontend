// Learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom'

// Polyfill Web Crypto API for jsdom (required by secureStorage)
const { webcrypto } = require('crypto')
const { TextEncoder, TextDecoder } = require('util')
Object.defineProperty(globalThis, 'crypto', { value: webcrypto, writable: false })
Object.defineProperty(globalThis, 'TextEncoder', { value: TextEncoder, writable: false })
Object.defineProperty(globalThis, 'TextDecoder', { value: TextDecoder, writable: false })
