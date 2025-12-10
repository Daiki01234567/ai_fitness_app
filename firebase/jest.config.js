module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  testMatch: ["**/__tests__/**/*.test.ts"],
  collectCoverageFrom: [
    "**/*.rules",
    "!**/node_modules/**",
    "!**/dist/**",
  ],
  coverageReporters: ["text", "lcov", "html"],
  setupFilesAfterEnv: ["<rootDir>/__tests__/setup.ts"],
  testTimeout: 30000,
  verbose: true,
  // Run tests serially to avoid race conditions with Firestore emulator
  maxWorkers: 1,
  // Force exit after all tests complete
  forceExit: true,
  // Detect open handles
  detectOpenHandles: false,
};
