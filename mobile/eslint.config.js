// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    // Build output and files Expo generates (typed routes) are not ours to lint.
    ignores: ["dist/*", ".expo/*"],
  }
]);
