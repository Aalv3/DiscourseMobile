#import <AuthenticationServices/AuthenticationServices.h>
#import <React/RCTBridgeModule.h>
#import <UIKit/UIKit.h>

@interface SafariWebAuth : NSObject <RCTBridgeModule, ASWebAuthenticationPresentationContextProviding>
@property(nonatomic, strong, nullable) ASWebAuthenticationSession *webAuthSession;
@property(nonatomic, strong, nullable) UIWindow *presentationWindow;
@end

@implementation SafariWebAuth

RCT_EXPORT_MODULE()

+ (BOOL)requiresMainQueueSetup
{
  return YES;
}

- (dispatch_queue_t)methodQueue
{
  return dispatch_get_main_queue();
}

- (nullable UIWindow *)activePresentationWindow
{
  NSArray<UIScene *> *connectedScenes = UIApplication.sharedApplication.connectedScenes.allObjects;
  for (NSNumber *state in @[ @(UISceneActivationStateForegroundActive), @(UISceneActivationStateForegroundInactive) ]) {
    for (UIScene *scene in connectedScenes) {
      if (scene.activationState != state.integerValue || ![scene isKindOfClass:UIWindowScene.class]) {
        continue;
      }

      UIWindowScene *windowScene = (UIWindowScene *)scene;
      for (UIWindow *window in windowScene.windows) {
        if (window.isKeyWindow) {
          return window;
        }
      }
      for (UIWindow *window in windowScene.windows) {
        if (!window.isHidden && window.alpha > 0 && window.windowLevel == UIWindowLevelNormal) {
          return window;
        }
      }
    }
  }
  return nil;
}

- (ASPresentationAnchor)presentationAnchorForWebAuthenticationSession:(ASWebAuthenticationSession *)session
{
  NSAssert(self.presentationWindow != nil, @"Authentication presentation window must be retained while the session is active.");
  return self.presentationWindow;
}

RCT_REMAP_METHOD(requestAuth,
                 requestAuth:(NSString *)url
                 callbackURLScheme:(NSString *)callbackURLScheme
                 ephemeral:(BOOL)ephemeral
                 resolver:(RCTPromiseResolveBlock)resolve
                 rejecter:(RCTPromiseRejectBlock)reject)
{
  NSURL *parsedURL = [NSURL URLWithString:url];
  if (parsedURL == nil) {
    reject(@"auth_invalid_url", @"The authentication URL is invalid.", nil);
    return;
  }

  UIWindow *window = [self activePresentationWindow];
  if (window == nil) {
    reject(@"auth_presentation_unavailable", @"No active app window is available to present authentication.", nil);
    return;
  }

  self.presentationWindow = window;
  __weak SafariWebAuth *weakSelf = self;
  __block BOOL settled = NO;
  ASWebAuthenticationSession *session = [[ASWebAuthenticationSession alloc]
    initWithURL:parsedURL
    callbackURLScheme:callbackURLScheme
    completionHandler:^(NSURL *_Nullable callbackURL, NSError *_Nullable error) {
      dispatch_async(dispatch_get_main_queue(), ^{
        if (settled) {
          return;
        }
        settled = YES;
        SafariWebAuth *strongSelf = weakSelf;
        strongSelf.webAuthSession = nil;
        strongSelf.presentationWindow = nil;

        if (error != nil) {
          reject(@"auth_session_failed", error.localizedDescription, error);
        } else if (callbackURL != nil) {
          resolve(callbackURL.absoluteString);
        } else {
          reject(@"auth_callback_missing", @"Authentication completed without a callback URL.", nil);
        }
      });
    }];
  session.presentationContextProvider = self;
  session.prefersEphemeralWebBrowserSession = ephemeral;
  self.webAuthSession = session;

  if (![session start]) {
    settled = YES;
    self.webAuthSession = nil;
    self.presentationWindow = nil;
    reject(@"auth_start_failed", @"The authentication session could not be started.", nil);
  }
}

@end
