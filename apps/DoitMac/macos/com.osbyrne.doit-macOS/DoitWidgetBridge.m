#import <React/RCTBridgeModule.h>

@interface RCT_EXTERN_MODULE(DoitWidgetBridge, NSObject)

RCT_EXTERN_METHOD(storeSessionToken:(NSString *)token
                  resolver:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
RCT_EXTERN_METHOD(loadSessionToken:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
RCT_EXTERN_METHOD(clearSessionToken:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
RCT_EXTERN_METHOD(takePendingURL:(RCTPromiseResolveBlock)resolve
                  rejecter:(RCTPromiseRejectBlock)reject)
RCT_EXTERN_METHOD(clearPendingURL)
RCT_EXTERN_METHOD(reloadTasksWidget)

@end
