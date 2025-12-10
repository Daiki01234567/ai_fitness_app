/**
 * Babel configuration for Expo
 *
 * @see https://docs.expo.dev/versions/latest/config/babel/
 * @see docs/expo/specs/01_技術スタック_v1_0.md
 */
module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      [
        "babel-preset-expo",
        {
          // Transform import.meta to globalThis.__ExpoImportMetaRegistry
          // Required for Firebase SDK v12+ which uses import.meta internally
          // This fixes: "Cannot use 'import.meta' outside a module" error on web
          unstable_transformImportMeta: true,

          // Disable worklets plugin on web (worklets are native-only)
          // This prevents "[Worklets] createSerializableObject" errors on web
          web: {
            worklets: false,
          },
        },
      ],
    ],
  };
};
