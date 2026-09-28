// Learn more: https://github.com/testing-library/jest-dom
import '@testing-library/jest-dom'

process.env.DATABASE_URL = process.env.DATABASE_URL || "postgresql://mock:mock@localhost:5432/mock";
process.env.NEXTAUTH_SECRET = process.env.NEXTAUTH_SECRET || "test-nextauth-secret-32-chars-long";
process.env.NEXTAUTH_URL = process.env.NEXTAUTH_URL || "http://localhost:3000";

// Polyfill Web Crypto API for jsdom (required by secureStorage)
const { webcrypto } = require('crypto')
const { TextEncoder, TextDecoder } = require('util')
Object.defineProperty(globalThis, 'crypto', { value: webcrypto, writable: false })
Object.defineProperty(globalThis, 'TextEncoder', { value: TextEncoder, writable: false })
Object.defineProperty(globalThis, 'TextDecoder', { value: TextDecoder, writable: false })

import { resetDataLayerForTests } from '@/app/lib/data-layer'

beforeEach(() => {
  resetDataLayerForTests()
})

