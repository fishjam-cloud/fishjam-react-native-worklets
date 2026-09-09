package com.fishjam.worklets;

import android.os.Build;
import android.util.Log;

import com.facebook.react.bridge.Promise;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.module.annotations.ReactModule;
import com.facebook.react.turbomodule.core.CallInvokerHolderImpl;

@ReactModule(name = FishjamWorkletsModule.NAME)
public class FishjamWorkletsModule extends NativeFishjamWorkletsSpec {
    public static final String NAME = NativeFishjamWorkletsSpec.NAME;

    private FJWorkletsInstaller installer;

    public FishjamWorkletsModule(ReactApplicationContext reactContext) {
        super(reactContext);
    }

    @Override
    public void install(Promise promise) {
        // Camera frames arrive as AHardwareBuffers, which need API 26.
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            promise.reject("E_UNSUPPORTED_API_LEVEL", "Camera frame worklets require Android 8.0 (API 26).");
            return;
        }
        FJWorkletsInstaller currentInstaller;
        try {
            currentInstaller = getInstaller();
        } catch (Throwable cause) {
            Log.w(NAME, "Failed to build the JSI installer", cause);
            promise.reject("E_NO_JSI", "Camera frame worklets could not be installed.", cause);
            return;
        }
        if (currentInstaller == null) {
            promise.reject("E_NO_JSI", "Camera frame worklets require the New Architecture.");
            return;
        }
        // Re-run the native install on every call: after a JS reload the runtime is
        // new while this module and the installer survive.
        currentInstaller.install(promise);
    }

    private synchronized FJWorkletsInstaller getInstaller() {
        if (installer != null) {
            return installer;
        }
        Object callInvokerHolder = getReactApplicationContext().getJSCallInvokerHolder();
        if (!(callInvokerHolder instanceof CallInvokerHolderImpl)) {
            return null;
        }
        installer = new FJWorkletsInstaller((CallInvokerHolderImpl) callInvokerHolder);
        return installer;
    }
}
