/** @type {import('jest').Config} */
/**
 * Jest Configuration for Integration Tests
 *
 * Integration tests require Firebase emulators to be running.
 * Run with: npm run test:integration
 *
 * Prerequisite: firebase emulators:start (in separate terminal)
 */
module.exports = {
  displayName: "integration",
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/tests/integration"],
  testMatch: ["**/*.test.ts"],
  transform: {
    "^.+\\.tsx?$": [
      "ts-jest",
      {
        tsconfig: "tsconfig.json",
        isolatedModules: true,
        diagnostics: {
          ignoreCodes: [151002],
        },
      },
    ],
  },
  moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json", "node"],
  setupFilesAfterEnv: ["<rootDir>/tests/integration/setup.ts"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
  },
  clearMocks: true,
  verbose: true,
  // Longer timeout for integration tests
  testTimeout: 30000,
  // Run tests sequentially to avoid conflicts
  maxWorkers: 1,
  // Don't collect coverage for integration tests
  collectCoverage: false,
};
