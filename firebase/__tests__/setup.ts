/**
 * Jest setup file for Firestore Security Rules tests
 * Runs before all test files
 */

import { readFileSync } from "fs";
import { resolve } from "path";

// Extend the global namespace for TypeScript
declare global {
  // eslint-disable-next-line no-var
  var FIRESTORE_RULES: string;
}

// Suppress noisy Firebase logs during testing
process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";

// Suppress specific Firebase warnings that don't affect test validity
const originalWarn = console.warn;
const originalError = console.error;

console.warn = (...args: unknown[]) => {
  const message = args[0];
  if (
    typeof message === "string" &&
    (message.includes("GrpcConnection RPC") ||
      message.includes("PERMISSION_DENIED") ||
      message.includes("@firebase/firestore"))
  ) {
    // Suppress expected Firestore warnings during security rules testing
    return;
  }
  originalWarn.apply(console, args);
};

console.error = (...args: unknown[]) => {
  const message = args[0];
  if (
    typeof message === "string" &&
    (message.includes("INTERNAL ASSERTION FAILED") ||
      message.includes("@firebase/firestore") ||
      message.includes("Unexpected state"))
  ) {
    // Suppress expected Firestore errors during cleanup
    return;
  }
  originalError.apply(console, args);
};

// Firestore ルールファイルのパスをグローバルに設定
const rulesPath = resolve(__dirname, "../firestore.rules");

try {
  const rules = readFileSync(rulesPath, "utf8");
  global.FIRESTORE_RULES = rules;
} catch (error) {
  console.error("Failed to read Firestore rules file:", error);
  throw error;
}

// Increase timeout for async operations
jest.setTimeout(30000);
