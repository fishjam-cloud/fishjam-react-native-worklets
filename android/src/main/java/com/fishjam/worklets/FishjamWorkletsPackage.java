package com.fishjam.worklets;

import androidx.annotation.Nullable;

import com.facebook.react.BaseReactPackage;
import com.facebook.react.bridge.NativeModule;
import com.facebook.react.bridge.ReactApplicationContext;
import com.facebook.react.module.model.ReactModuleInfo;
import com.facebook.react.module.model.ReactModuleInfoProvider;

import java.util.Collections;

public class FishjamWorkletsPackage extends BaseReactPackage {
    @Nullable
    @Override
    public NativeModule getModule(String name, ReactApplicationContext reactContext) {
        if (FishjamWorkletsModule.NAME.equals(name)) {
            return new FishjamWorkletsModule(reactContext);
        }
        return null;
    }

    @Override
    public ReactModuleInfoProvider getReactModuleInfoProvider() {
        return () -> Collections.singletonMap(
            FishjamWorkletsModule.NAME,
            new ReactModuleInfo(
                FishjamWorkletsModule.NAME,
                FishjamWorkletsModule.class.getName(),
                false,
                false,
                false,
                true));
    }
}
