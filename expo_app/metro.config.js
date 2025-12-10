/**
 * Metro configuration for Expo
 *
 * @see https://docs.expo.dev/guides/customizing-metro/
 * @see docs/expo/specs/01_技術スタック_v1_0.md
 */
const { getDefaultConfig } = require("expo/metro-config");

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Enable experimental import support for better ESM compatibility
// This helps with Firebase SDK v12+ and other modern packages
config.transformer.getTransformOptions = async () => ({
  transform: {
    experimentalImportSupport: true,
    inlineRequires: true,
  },
});

module.exports = config;
