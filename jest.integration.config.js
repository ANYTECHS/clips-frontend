/**
 * Jest config for @integration tests (Stellar testnet / local network).
 * Kept separate so `npm test` stays fast and offline-friendly.
 */
const nextJest = require("next/jest");

const createJestConfig = nextJest({
  dir: "./",
});

const customJestConfig = {
  setupFilesAfterEnv: ["<rootDir>/jest.setup.js"],
  testEnvironment: "jest-environment-node",
  moduleNameMapper: {
    "^@/hooks/(.*)$": "<rootDir>/app/hooks/$1",
    "^@/components/(.*)$": "<rootDir>/components/$1",
    "^@/app/(.*)$": "<rootDir>/app/$1",
    "^@/(.*)$": "<rootDir>/$1",
  },
  testMatch: ["**/__tests__/integration/**/*.integration.test.[jt]s?(x)"],
  testPathIgnorePatterns: ["<rootDir>/node_modules/", "<rootDir>/tests/e2e/"],
  testTimeout: 90_000,
  // Friendbot / Horizon are shared public services — avoid parallel account spam
  maxWorkers: 1,
};

module.exports = createJestConfig(customJestConfig);
