#import <Foundation/Foundation.h>

#import <FishjamWorkletsSpec/FishjamWorkletsSpec.h>

#include <memory>

#include "FJWorkletsJSI.h"

@interface FishjamWorkletsModule : NSObject <NativeFishjamWorkletsSpec>
@end

@implementation FishjamWorkletsModule {
    std::shared_ptr<fishjam::worklets::FJWorkletsInstaller> installer_;
}

RCT_EXPORT_MODULE(FishjamWorklets)

+ (BOOL)requiresMainQueueSetup {
    return NO;
}

RCT_EXPORT_METHOD(install : (RCTPromiseResolveBlock)resolve reject : (RCTPromiseRejectBlock)reject) {
    if (!installer_) {
        reject(@"E_NO_JSI", @"Camera frame worklets require the New Architecture.", nil);
        return;
    }
    installer_->install([resolve]() { resolve(nil); });
}

- (std::shared_ptr<facebook::react::TurboModule>)getTurboModule:
    (const facebook::react::ObjCTurboModule::InitParams &)params {
    if (params.jsInvoker) {
        installer_ = std::make_shared<fishjam::worklets::FJWorkletsInstaller>(params.jsInvoker);
    }
    return std::make_shared<facebook::react::NativeFishjamWorkletsSpecJSI>(params);
}

@end
