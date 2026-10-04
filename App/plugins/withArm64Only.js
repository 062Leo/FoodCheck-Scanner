/* global require, module */
/* eslint-disable @typescript-eslint/no-require-imports */
// Builds the Android app for arm64-v8a only.
// reactNativeArchitectures limits the native code compiled from source (React Native, Expo modules).
// Prebuilt AARs such as ML Kit ship their own .so files for every ABI and ignore that property,
// so ndk.abiFilters in the app module strips the remaining ABIs when the APK is packaged.
const { withGradleProperties, withAppBuildGradle } = require('expo/config-plugins');

const ABI = 'arm64-v8a';
const ABI_FILTER_LINE = `ndk { abiFilters "${ABI}" }`;

function setGradleProperty(properties, name, value) {
  const existing = properties.find((entry) => entry.type === 'property' && entry['key'] === name);
  if (existing) {
    existing.value = value;
  } else {
    properties.push({ type: 'property', ['key']: name, value });
  }
  return properties;
}

function addAbiFilter(buildGradle) {
  if (buildGradle.includes(ABI_FILTER_LINE)) {
    return buildGradle;
  }
  const anchor = /defaultConfig\s*\{/;
  if (!anchor.test(buildGradle)) {
    throw new Error('withArm64Only: defaultConfig block not found in app/build.gradle');
  }
  return buildGradle.replace(anchor, (match) => `${match}\n        ${ABI_FILTER_LINE}`);
}

function withArm64Only(config) {
  config = withGradleProperties(config, (mod) => {
    mod.modResults = setGradleProperty(mod.modResults, 'reactNativeArchitectures', ABI);
    return mod;
  });
  config = withAppBuildGradle(config, (mod) => {
    mod.modResults.contents = addAbiFilter(mod.modResults.contents);
    return mod;
  });
  return config;
}

module.exports = withArm64Only;
module.exports.setGradleProperty = setGradleProperty;
module.exports.addAbiFilter = addAbiFilter;
