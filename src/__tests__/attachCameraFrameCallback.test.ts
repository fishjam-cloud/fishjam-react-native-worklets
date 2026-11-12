import type { CameraFrameProcessor } from '@fishjam-cloud/react-native-webrtc';

import type * as Library from '../index';

jest.mock('react-native', () => ({
  TurboModuleRegistry: { get: jest.fn() },
}));

jest.mock('react-native-worklets', () => ({
  createWorkletRuntime: jest.fn(() => ({ name: 'FishjamCameraFrames' })),
  scheduleOnRuntime: jest.fn((_runtime: unknown, worklet: () => void) => worklet()),
}));

interface MockConsumer {
  bindRuntime: jest.Mock;
  setCallback: jest.Mock;
  clearCallback: jest.Mock;
}

interface MockProcessor extends CameraFrameProcessor {
  attach: jest.Mock;
  detach: jest.Mock;
}

interface Harness {
  attachCameraFrameCallback: typeof Library.attachCameraFrameCallback;
  install: jest.Mock;
  createConsumer: jest.Mock<MockConsumer, []>;
  createWorkletRuntime: jest.Mock;
}

function createConsumer(): MockConsumer {
  return { bindRuntime: jest.fn(), setCallback: jest.fn(), clearCallback: jest.fn() };
}

function createProcessor(trackId = 'camera-track'): MockProcessor {
  return { trackId, attach: jest.fn(), detach: jest.fn() } as unknown as MockProcessor;
}

function createCameraTrack(trackId = 'camera-track') {
  let attachedConsumer: unknown = null;
  return {
    attachedConsumer: () => attachedConsumer,
    getProcessor(): MockProcessor {
      const processor = createProcessor(trackId);
      processor.attach.mockImplementation((consumer: unknown) => {
        attachedConsumer = consumer;
      });
      processor.detach.mockImplementation(() => {
        attachedConsumer = null;
      });
      return processor;
    },
  };
}

const frameCallback: Library.CameraFrameCallback = () => {};

function loadLibrary({ isLinked = true, install = jest.fn(async () => {}) } = {}): Harness {
  jest.resetModules();
  const createConsumerMock = jest.fn(createConsumer);
  (globalThis as { __fishjamWorklets?: unknown }).__fishjamWorklets = { createConsumer: createConsumerMock };

  const { TurboModuleRegistry } = jest.requireMock<{ TurboModuleRegistry: { get: jest.Mock } }>('react-native');
  TurboModuleRegistry.get.mockReturnValue(isLinked ? { install } : null);
  const { createWorkletRuntime } = jest.requireMock<{ createWorkletRuntime: jest.Mock }>('react-native-worklets');
  const { attachCameraFrameCallback } = jest.requireActual<typeof Library>('../index');

  return { attachCameraFrameCallback, install, createConsumer: createConsumerMock, createWorkletRuntime };
}

function rejectingInstall(code: string): jest.Mock {
  return jest.fn(async () => {
    throw Object.assign(new Error('native rejection'), { code });
  });
}

describe('attachCameraFrameCallback', () => {
  afterEach(() => {
    delete (globalThis as { __fishjamWorklets?: unknown }).__fishjamWorklets;
  });

  test('maps E_NO_JSI to the New Architecture message and allows a retry', async () => {
    const install = jest.fn();
    install.mockImplementationOnce(rejectingInstall('E_NO_JSI')).mockImplementation(async () => {});
    const harness = loadLibrary({ install });
    const processor = createProcessor();

    await expect(harness.attachCameraFrameCallback(processor, frameCallback)).rejects.toThrow(
      'Camera frame worklets require the New Architecture.',
    );
    await expect(harness.attachCameraFrameCallback(processor, frameCallback)).resolves.toBeDefined();
    expect(install).toHaveBeenCalledTimes(2);
  });

  test('throws the not-linked error when the native module is missing', async () => {
    const harness = loadLibrary({ isLinked: false });

    await expect(harness.attachCameraFrameCallback(createProcessor(), frameCallback)).rejects.toThrow(
      '@fishjam-cloud/react-native-worklets is not linked',
    );
  });

  test('installs once and reuses the runtime across subscriptions', async () => {
    const harness = loadLibrary();

    await harness.attachCameraFrameCallback(createProcessor(), frameCallback);
    await harness.attachCameraFrameCallback(createProcessor(), frameCallback);

    expect(harness.install).toHaveBeenCalledTimes(1);
    expect(harness.createWorkletRuntime).toHaveBeenCalledTimes(1);
    expect(harness.createConsumer).toHaveBeenCalledTimes(2);
  });

  test('sets the callback on the runtime before attaching to the processor', async () => {
    const harness = loadLibrary();
    const processor = createProcessor();

    await harness.attachCameraFrameCallback(processor, frameCallback);

    const consumer = harness.createConsumer.mock.results[0].value;
    expect(consumer.bindRuntime).toHaveBeenCalledWith({ name: 'FishjamCameraFrames' });
    expect(consumer.setCallback).toHaveBeenCalledWith(frameCallback);
    expect(consumer.setCallback.mock.invocationCallOrder[0]).toBeLessThan(processor.attach.mock.invocationCallOrder[0]);
    expect(processor.attach).toHaveBeenCalledWith(consumer);
  });

  test('clears the callback when attach throws', async () => {
    const harness = loadLibrary();
    const processor = createProcessor();
    processor.attach.mockImplementation(() => {
      throw new Error('track ended');
    });

    await expect(harness.attachCameraFrameCallback(processor, frameCallback)).rejects.toThrow('track ended');

    const consumer = harness.createConsumer.mock.results[0].value;
    expect(consumer.clearCallback).toHaveBeenCalledTimes(1);
    await expect(harness.attachCameraFrameCallback(processor, frameCallback)).rejects.toThrow('track ended');
  });

  test('remove detaches, clears the callback and is idempotent', async () => {
    const harness = loadLibrary();
    const processor = createProcessor();

    const subscription = await harness.attachCameraFrameCallback(processor, frameCallback);
    subscription.remove();
    subscription.remove();

    const consumer = harness.createConsumer.mock.results[0].value;
    expect(processor.detach).toHaveBeenCalledTimes(1);
    expect(consumer.clearCallback).toHaveBeenCalledTimes(1);
  });

  test('rejects a second callback on the same processor but allows one on another', async () => {
    const harness = loadLibrary();
    const processor = createProcessor();

    await harness.attachCameraFrameCallback(processor, frameCallback);

    await expect(harness.attachCameraFrameCallback(processor, frameCallback)).rejects.toThrow(
      'A camera frame callback is already attached.',
    );
    await expect(
      harness.attachCameraFrameCallback(createProcessor('other-track'), frameCallback),
    ).resolves.toBeDefined();
  });

  test('rejects a concurrent attach on the same processor while install is pending', async () => {
    const harness = loadLibrary();
    const processor = createProcessor();

    const results = await Promise.allSettled([
      harness.attachCameraFrameCallback(processor, frameCallback),
      harness.attachCameraFrameCallback(processor, frameCallback),
    ]);

    expect(results.map((result) => result.status)).toEqual(['fulfilled', 'rejected']);
  });

  test('lets the same processor attach again after remove', async () => {
    const harness = loadLibrary();
    const processor = createProcessor();

    const subscription = await harness.attachCameraFrameCallback(processor, frameCallback);
    subscription.remove();

    await expect(harness.attachCameraFrameCallback(processor, frameCallback)).resolves.toBeDefined();
    expect(processor.attach).toHaveBeenCalledTimes(2);
  });

  describe('when a new processor handle replaces a subscription on the same track', () => {
    test('removing the replaced subscription leaves the newer consumer attached', async () => {
      const harness = loadLibrary();
      const track = createCameraTrack();

      const replaced = await harness.attachCameraFrameCallback(track.getProcessor(), frameCallback);
      await harness.attachCameraFrameCallback(track.getProcessor(), frameCallback);
      const [replacedConsumer, newerConsumer] = harness.createConsumer.mock.results.map((result) => result.value);
      replaced.remove();

      expect(track.attachedConsumer()).toBe(newerConsumer);
      expect(replacedConsumer.clearCallback).toHaveBeenCalledTimes(1);
      expect(newerConsumer.clearCallback).not.toHaveBeenCalled();
    });

    test('removing the newer subscription detaches the track', async () => {
      const harness = loadLibrary();
      const track = createCameraTrack();

      const replaced = await harness.attachCameraFrameCallback(track.getProcessor(), frameCallback);
      const newer = await harness.attachCameraFrameCallback(track.getProcessor(), frameCallback);
      const newerConsumer = harness.createConsumer.mock.results[1].value;
      replaced.remove();
      newer.remove();

      expect(track.attachedConsumer()).toBeNull();
      expect(newerConsumer.clearCallback).toHaveBeenCalledTimes(1);
    });

    test('a failed attach leaves the earlier subscription able to detach', async () => {
      const harness = loadLibrary();
      const track = createCameraTrack();
      const failingProcessor = track.getProcessor();
      failingProcessor.attach.mockImplementation(() => {
        throw new Error('attach failed');
      });

      const earlier = await harness.attachCameraFrameCallback(track.getProcessor(), frameCallback);
      await expect(harness.attachCameraFrameCallback(failingProcessor, frameCallback)).rejects.toThrow('attach failed');
      earlier.remove();

      expect(track.attachedConsumer()).toBeNull();
    });
  });

  test('removing a subscription does not affect another track', async () => {
    const harness = loadLibrary();
    const firstTrack = createCameraTrack('first-track');
    const secondTrack = createCameraTrack('second-track');

    const first = await harness.attachCameraFrameCallback(firstTrack.getProcessor(), frameCallback);
    const second = await harness.attachCameraFrameCallback(secondTrack.getProcessor(), frameCallback);
    const secondConsumer = harness.createConsumer.mock.results[1].value;
    first.remove();

    expect(firstTrack.attachedConsumer()).toBeNull();
    expect(secondTrack.attachedConsumer()).toBe(secondConsumer);

    second.remove();
    expect(secondTrack.attachedConsumer()).toBeNull();
  });
});
