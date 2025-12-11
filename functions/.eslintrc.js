module.exports = {
  root: true,
  env: {
    es2022: true,
    node: true,
  },
  extends: [
    "eslint:recommended",
    "plugin:import/errors",
    "plugin:import/warnings",
    "plugin:import/typescript",
    "google",
    "plugin:@typescript-eslint/recommended",
    "plugin:@typescript-eslint/recommended-requiring-type-checking",
    "prettier",
  ],
  parser: "@typescript-eslint/parser",
  parserOptions: {
    project: ["tsconfig.json", "tsconfig.dev.json"],
    sourceType: "module",
    ecmaVersion: 2022,
  },
  ignorePatterns: [
    "/lib/**/*",
    "/generated/**/*",
    "node_modules/",
    "*.js",
  ],
  plugins: [
    "@typescript-eslint",
    "import",
  ],
  rules: {
    // Quotes and formatting
    "quotes": ["error", "double", { "avoidEscape": true }],
    "semi": ["error", "always"],
    "indent": ["error", 2, { "SwitchCase": 1 }],
    "max-len": ["error", { "code": 100, "ignoreUrls": true, "ignoreStrings": true }],
    "comma-dangle": ["error", "always-multiline"],

    // TypeScript specific
    "@typescript-eslint/no-unused-vars": ["error", { "argsIgnorePattern": "^_" }],
    "@typescript-eslint/explicit-function-return-type": "off",
    "@typescript-eslint/explicit-module-boundary-types": "off",
    "@typescript-eslint/no-explicit-any": "warn",
    "@typescript-eslint/no-floating-promises": "error",
    "@typescript-eslint/no-misused-promises": "error",
    "@typescript-eslint/await-thenable": "error",
    "@typescript-eslint/require-await": "error",

    // Import rules
    "import/no-unresolved": "off",
    "import/order": ["error", {
      "groups": ["builtin", "external", "internal", "parent", "sibling", "index"],
      "newlines-between": "always",
      "alphabetize": { "order": "asc" },
    }],

    // General rules
    "no-console": "warn",
    "no-debugger": "error",
    "no-duplicate-imports": "error",
    "eqeqeq": ["error", "always"],
    "curly": ["error", "all"],
    "prefer-const": "error",
    "no-var": "error",

    // Google style overrides
    "require-jsdoc": "off",
    "valid-jsdoc": "off",
    "new-cap": "off",
    // Allow snake_case for Firebase function exports (e.g., auth_onCreate, gdpr_requestDataExport)
    // Also allow Stripe SDK snake_case properties (e.g., line_items, cancel_at_period_end)
    "camelcase": ["error", {
      "allow": [
        "^auth_",
        "^gdpr_",
        "^user_",
        "^training_",
        "^consent_",
        "^settings_",
        "^subscription_",
        "^triggers_",
        "^scheduled_",
        "^webhook_",
        "^stripe_",
        "^analytics_",
        "^admin_",
        "^pubsub_",
        // Stripe SDK properties (snake_case)
        "line_items",
        "success_url",
        "cancel_url",
        "trial_period_days",
        "allow_promotion_codes",
        "billing_address_collection",
        "cancel_at_period_end",
        "proration_behavior",
        "period_days",
        "exercise_id",
      ],
      "properties": "never",
    }],
  },
};
