#import "DiscourseKeyboardShortcuts.h"
#import <Security/Security.h>

@implementation DiscourseKeyboardShortcuts

static NSString *pendingAPNSToken = nil;

+ (void)storeAPNSToken:(NSData *)deviceToken
{
  const unsigned char *bytes = deviceToken.bytes;
  NSMutableString *token = [NSMutableString stringWithCapacity:deviceToken.length * 2];
  for (NSUInteger index = 0; index < deviceToken.length; index++) {
    [token appendFormat:@"%02x", bytes[index]];
  }
  @synchronized(self) {
    pendingAPNSToken = [token copy];
  }
}

+ (id)allocWithZone:(NSZone *)zone {
    static DiscourseKeyboardShortcuts *sharedInstance = nil;
    static dispatch_once_t onceToken;
    dispatch_once(&onceToken, ^{
        sharedInstance = [super allocWithZone:zone];
    });
    return sharedInstance;
}


+ (BOOL)requiresMainQueueSetup
{
  return NO;
}

- (dispatch_queue_t)methodQueue
{
  return dispatch_get_main_queue();
}

RCT_EXPORT_MODULE()

- (NSArray<NSString *> *)supportedEvents
{
  return @[@"keyInputEvent"];
}

- (void) sendEvent:(NSString *)eventInput {
  [self sendEventWithName:@"keyInputEvent" body:@{@"input": eventInput}];
}

RCT_EXPORT_METHOD(updateFileMenu:(NSArray *)menuItems)
{
  // Update menu items when adding/deleting/reordering sites in React Native
  [[NSUserDefaults standardUserDefaults] setObject:menuItems forKey:@"menuItems"];
}

RCT_REMAP_METHOD(consumeAPNSToken,
                 consumeAPNSTokenWithResolver:(RCTPromiseResolveBlock)resolve
                 rejecter:(RCTPromiseRejectBlock)reject)
{
  NSString *token = nil;
  @synchronized([self class]) {
    token = pendingAPNSToken;
    pendingAPNSToken = nil;
  }
  resolve(token ?: [NSNull null]);
}

RCT_REMAP_METHOD(generateSecureInstallationId,
                 generateSecureInstallationIdWithResolver:(RCTPromiseResolveBlock)resolve
                 rejecter:(RCTPromiseRejectBlock)reject)
{
  uint8_t bytes[32];
  OSStatus status = SecRandomCopyBytes(kSecRandomDefault, sizeof(bytes), bytes);
  if (status != errSecSuccess) {
    reject(@"secure_random_failed", @"Secure installation identity unavailable", nil);
    return;
  }
  NSMutableString *identifier = [NSMutableString stringWithCapacity:sizeof(bytes) * 2];
  for (NSUInteger index = 0; index < sizeof(bytes); index++) {
    [identifier appendFormat:@"%02x", bytes[index]];
  }
  resolve(identifier);
}

@end
