# @fishjam-cloud/react-native-worklets

Run a worklet on every frame a Fishjam camera track captures. This is the optional
frame-processing tier of `@fishjam-cloud/react-native-webrtc`: apps that do not install
it compile no extra native code.

## Install

```sh
yarn add @fishjam-cloud/react-native-worklets react-native-worklets
```

Peer dependencies: `@fishjam-cloud/react-native-webrtc`, `react-native-worklets` (0.12.x)
and the `react-native-worklets/plugin` Babel plugin in the app. Requires the New
Architecture on both platforms.

## Versioning

The minor version follows the `react-native-worklets` minor it is built for:
`0.12.x` of this package works with `react-native-worklets` `0.12.x`. Patch releases
are this package's own fixes and do not change the supported `react-native-worklets`.

## Compatibility

| This package | react-native-worklets | @fishjam-cloud/react-native-webrtc | React Native |
| ------------ | --------------------- | ---------------------------------- | ------------ |
| 0.12.x       | 0.12.x                | >= 0.30.2                          | 0.86         |

### iOS

The module is a TurboModule, so the app must run the New Architecture (the default in
Expo and React Native templates). It needs iOS 15.1 or newer, the same as React Native
0.86 (Expo SDK 57 apps target 16.4). `install()` runs once from JS: it needs the JS call invoker that the New
Architecture hands to every TurboModule, and rejects with `E_NO_JSI` when it is not
there. Frames are `CVPixelBufferRef`s in the camera's native format (NV12 or BGRA).

### Android

The module is autolinked like any other. It compiles against the fork's public C++
header and links `libworklets.so`, so `react-native-worklets` must be an app dependency
(the Gradle build fails with a clear message otherwise). Camera frames are hardware
buffers, which need Android 8.0 (API 26) at runtime; on older devices `install()`
rejects with `E_UNSUPPORTED_API_LEVEL`. Frames are RGBA on Android: the camera tap
converts the camera texture before handing it over, and waits for that conversion to
finish before your callback runs.

## Usage

```ts
import { getCameraFrameProcessor } from '@fishjam-cloud/react-native-webrtc';
import { attachCameraFrameCallback } from '@fishjam-cloud/react-native-worklets';

const processor = await getCameraFrameProcessor(cameraTrack);
const subscription = await attachCameraFrameCallback(processor, (frame) => {
  'worklet';
  // frame.nativeBuffer is a CVPixelBufferRef (iOS) or AHardwareBuffer* (Android) pointer;
  // valid until this returns.
  render(frame.nativeBuffer, frame.width, frame.height, frame.rotationDegrees);
});

subscription.remove();
```

The callback runs on a dedicated camera frame runtime, never on the JS thread. Frames are
admitted one at a time: while the callback holds a frame, newer ones are dropped. Each
processor takes one callback at a time; remove it before attaching another to the same
processor. Different processors (different camera tracks) can each have their own.

## Troubleshooting

**`Camera frame worklets require the New Architecture.` (`E_NO_JSI`)**
The native module could not reach the JS runtime. Turn on the New Architecture
(`newArchEnabled` in `app.json` for Expo, `newArchEnabled=true` in `gradle.properties`
and `RCT_NEW_ARCH_ENABLED=1` for a bare app) and rebuild the native app.

**`Camera frame worklets require Android 8.0 (API 26).` (`E_UNSUPPORTED_API_LEVEL`)**
The device is too old for hardware buffers. There is no workaround; skip frame
processing on such devices.

**`@fishjam-cloud/react-native-worklets is not linked.`**
JS found no native module. Rebuild the app after installing the package (`expo prebuild`
or `pod install`; a JS-only reload is not enough), and check that the package is a
direct dependency of the app so autolinking sees it.
On Android, if the module was installed before as an older version, also delete
`android/build/generated/autolinking` in the app: React Native caches the autolinking
manifest there, and a stale one leaves out the codegen glue this module needs.

**`react-native-worklets was not found in the project.` (Gradle)**
The Android build links `libworklets.so` from the app's copy of `react-native-worklets`.
Add `react-native-worklets` to the app's own `dependencies` (not only to a library) and
run the build again.

## Example app

`example/` is a minimal Expo app that links this package from the repository. Run
`yarn install` at the root, then in `example/`: `yarn expo prebuild` and
`yarn android` or `yarn ios`. CI builds it for both platforms.
