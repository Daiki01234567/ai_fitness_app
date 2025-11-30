/** @type {import('jest').Config} */
module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/src", "<rootDir>/tests"],
  testMatch: ["**/*.test.ts", "**/*.spec.ts"],
  moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json", "node"],
  collectCoverageFrom: [
    "src/**/*.ts",
    "!src/**/*.d.ts",
    "!src/**/index.ts",
    // Exclude Cloud Functions v2 onCall wrappers (require integration tests)
    "!src/api/**/*.ts",
    // Exclude Firebase triggers (require emulator)
    "!src/auth/**/*.ts",
    "!src/triggers/**/*.ts",
  ],
  coverageDirectory: "coverage",
  coverageReporters: ["text", "lcov", "html"],
  coverageThreshold: {
    // Unit-testable code coverage targets (adjusted for realistic goals)
    global: {
      branches: 20,
      functions: 35,
      lines: 40,
      statements: 40,
    },
  },
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
  },
  clearMocks: true,
  verbose: true,
  // Projects for different test types
  projects: [
    {
      displayName: "unit",
      preset: "ts-jest",
      testEnvironment: "node",
      testMatch: ["<rootDir>/tests/**/*.test.ts"],
      testPathIgnorePatterns: [
        "<rootDir>/node_modules/",
        "<rootDir>/tests/integration/",
      ],
      transform: {
        "^.+\.tsx?$": [
          "ts-jest",
          {
            tsconfig: "tsconfig.json",
            diagnostics: {
              ignoreCodes: [151002],
            },
          },
        ],
      },
      setupFilesAfterEnv: ["<rootDir>/tests/setup.ts"],
      moduleNameMapper: {
        "^@/(.*)$": "<rootDir>/src/$1",
      },
    },
    {
      displayName: "integration",
      preset: "ts-jest",
      testEnvironment: "node",
      testMatch: ["<rootDir>/tests/integration/**/*.test.ts"],
      transform: {
        "^.+\.tsx?$": [
          "ts-jest",
          {
            tsconfig: "tsconfig.json",
            diagnostics: {
              ignoreCodes: [151002],
            },
          },
        ],
      },
      setupFilesAfterEnv: ["<rootDir>/tests/integration/setup.ts"],
      moduleNameMapper: {
        "^@/(.*)$": "<rootDir>/src/$1",
      },
    },
  ],
};
