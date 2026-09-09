# Changelog

## 0.12.1

No code changes since `0.12.0`. That version was published to npm by hand; this one
goes out through the GitHub release workflow, so the package carries npm provenance.

## 0.12.0

First release versioned after `react-native-worklets`: `0.12.x` pairs with
`react-native-worklets` `0.12.x`.

- The native module is a TurboModule with a codegen spec (`NativeFishjamWorklets`).
- One camera frame callback per processor: different camera tracks can each have a
  subscription at the same time. A second callback on the same processor still throws.
- Android: Java 17, `compileSdk`/`targetSdk` fall back to 35, `react-android` is pinned
  by the React Native Gradle plugin.
- Jest tests for the JS entry, a minimal Expo example app and native CI builds for
  Android and iOS.
