/** @type {import('jest').Config} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/src", "<rootDir>/tests"],
  testMatch: ["**/*.test.ts", "**/*.spec.ts"],
  // Exclude integration tests from default test run (require emulators)
  testPathIgnorePatterns: [
    "<rootDir>/node_modules/",
    "<rootDir>/tests/integration/",
  ],
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
  collectCoverageFrom: [
    "src/**/*.ts",
    "!src/**/*.d.ts",
    "!src/**/index.ts",
  ],
  coverageDirectory: "coverage",
  coverageReporters: ["text", "lcov", "html"],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 70,
      lines: 70,
      statements: 70,
    },
  },
  setupFilesAfterEnv: ["<rootDir>/tests/setup.ts"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
  },
  clearMocks: true,
  verbose: true,
  testTimeout: 10000,
  // Projects for different test types
  projects: [
    {
      displayName: "unit",
      testMatch: [
        "<rootDir>/tests/**/*.test.ts",
        "!<rootDir>/tests/integration/**",
      ],
      setupFilesAfterEnv: ["<rootDir>/tests/setup.ts"],
    },
  ],
};
