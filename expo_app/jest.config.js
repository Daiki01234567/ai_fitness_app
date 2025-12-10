/**
 * Jest Configuration
 *
 * Configuration for running unit tests in the Expo app.
 */

module.exports = {
  preset: "jest-expo",
  testEnvironment: "node",
  roots: ["<rootDir>/services", "<rootDir>/lib"],
  testMatch: ["**/__tests__/**/*.test.ts", "**/__tests__/**/*.test.tsx"],
  moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json", "node"],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/$1",
  },
  transformIgnorePatterns: [
    "node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg)",
  ],
  setupFilesAfterEnv: [],
  collectCoverageFrom: [
    "services/**/*.{ts,tsx}",
    "lib/**/*.{ts,tsx}",
    "!**/__tests__/**",
    "!**/node_modules/**",
  ],
  coverageThreshold: {
    global: {
      branches: 70,
      functions: 80,
      lines: 80,
      statements: 80,
    },
  },
};
