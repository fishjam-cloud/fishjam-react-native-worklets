/**
 * Runs a worklet on every frame a Fishjam camera track captures.
 *
 * ```ts
 * import { getCameraFrameProcessor } from '@fishjam-cloud/react-native-webrtc';
 * import { attachCameraFrameCallback } from '@fishjam-cloud/react-native-worklets';
 *
 * const processor = await getCameraFrameProcessor(cameraTrack);
 * const subscription = await attachCameraFrameCallback(processor, (frame) => {
 *   'worklet';
 *   render(frame.nativeBuffer, frame.width, frame.height);
 * });
 * // ...
 * subscription.remove();
 * ```
 */
import type { CameraFrameConsumer, CameraFrameProcessor } from '@fishjam-cloud/react-native-webrtc';
import { createWorkletRuntime, scheduleOnRuntime, type WorkletRuntime } from 'react-native-worklets';

import NativeFishjamWorklets, { type Spec as FishjamWorkletsNativeModule } from './NativeFishjamWorklets';

export type CameraFramePixelFormat = 'nv12' | 'bgra8' | 'rgba8' | 'unknown';

/**
 * A camera frame handed to a {@link CameraFrameCallback}. The native buffer is
 * valid only until the callback returns, or until `release()` is called.
 */
export interface CameraFrame {
  /** `CVPixelBufferRef` on iOS, `AHardwareBuffer*` on Android, as a pointer value. */
  readonly nativeBuffer: bigint;
  readonly width: number;
  readonly height: number;
  readonly rotationDegrees: number;
  readonly isFrontCamera: boolean;
  readonly timestampNanoseconds: number;
  readonly pixelFormat: CameraFramePixelFormat;
  readonly isReleased: boolean;
  /** Hands the buffer back to the camera early. Safe to repeat. */
  release(): void;
}

/** A `'worklet'` function; it runs on the camera frame runtime, never on the JS thread. */
export type CameraFrameCallback = (frame: CameraFrame) => void;

export interface CameraFrameSubscription {
  /** Detaches from the track and clears the callback. Safe to repeat. */
  remove(): void;
}

interface CameraFrameConsumerHandle extends CameraFrameConsumer {
  bindRuntime(runtime: WorkletRuntime): void;
  setCallback(callback: CameraFrameCallback): void;
  clearCallback(): void;
}

interface FishjamWorkletsBinding {
  createConsumer(): CameraFrameConsumerHandle;
}

declare const global: {
  __fishjamWorklets?: FishjamWorkletsBinding;
};

const RUNTIME_NAME = 'FishjamCameraFrames';

interface CameraFrameRuntime {
  readonly binding: FishjamWorkletsBinding;
  readonly runtime: WorkletRuntime;
}

let runtimePromise: Promise<CameraFrameRuntime> | null = null;
const activeSubscriptions = new WeakMap<CameraFrameProcessor, CameraFrameSubscription>();

function nativeModule(): FishjamWorkletsNativeModule {
  const module = NativeFishjamWorklets;
  if (!module) {
    throw new Error(
      '@fishjam-cloud/react-native-worklets is not linked. Install the package and rebuild the native app.',
    );
  }
  return module;
}

function describeInstallError(cause: unknown): Error {
  if (cause instanceof Error) {
    return (cause as { code?: string }).code === 'E_NO_JSI'
      ? new Error('Camera frame worklets require the New Architecture.')
      : cause;
  }
  return new Error(`Camera frame worklets install failed: ${String(cause)}`);
}

async function createCameraFrameRuntime(): Promise<CameraFrameRuntime> {
  await nativeModule().install();
  const binding = global.__fishjamWorklets;
  if (!binding) {
    throw new Error('Camera frame worklets binding was not installed.');
  }
  const runtime = createWorkletRuntime({ name: RUNTIME_NAME });
  return { binding, runtime };
}

// One runtime for the whole app: worklet runtimes cannot be destroyed, and each
// one owns a thread. Consumers are cheap, so every subscription gets its own.
function ensureCameraFrameRuntime(): Promise<CameraFrameRuntime> {
  if (!runtimePromise) {
    runtimePromise = createCameraFrameRuntime().catch((cause: unknown) => {
      runtimePromise = null;
      throw describeInstallError(cause);
    });
  }
  return runtimePromise;
}

function throwIfAttached(processor: CameraFrameProcessor): void {
  if (activeSubscriptions.has(processor)) {
    throw new Error('A camera frame callback is already attached. Remove it before attaching another.');
  }
}

/**
 * Starts calling `callback` on the camera frame runtime for every frame the
 * processor's track captures. Each processor can have one callback at a time;
 * remove the previous subscription before attaching another to the same
 * processor. Different processors may each have their own.
 */
export async function attachCameraFrameCallback(
  processor: CameraFrameProcessor,
  callback: CameraFrameCallback,
): Promise<CameraFrameSubscription> {
  throwIfAttached(processor);
  const { binding, runtime } = await ensureCameraFrameRuntime();
  throwIfAttached(processor);

  const consumer = binding.createConsumer();
  consumer.bindRuntime(runtime);
  scheduleOnRuntime(runtime, () => {
    'worklet';
    consumer.setCallback(callback);
  });

  try {
    processor.attach(consumer);
  } catch (cause) {
    scheduleOnRuntime(runtime, () => {
      'worklet';
      consumer.clearCallback();
    });
    throw cause;
  }

  let removed = false;
  const subscription: CameraFrameSubscription = {
    remove() {
      if (removed) {
        return;
      }
      removed = true;
      if (activeSubscriptions.get(processor) === subscription) {
        activeSubscriptions.delete(processor);
      }
      processor.detach();
      scheduleOnRuntime(runtime, () => {
        'worklet';
        consumer.clearCallback();
      });
    },
  };
  activeSubscriptions.set(processor, subscription);
  return subscription;
}
