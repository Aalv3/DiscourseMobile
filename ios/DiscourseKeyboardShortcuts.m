#import "DiscourseKeyboardShortcuts.h"
#import <Security/Security.h>
#import <TargetConditionals.h>

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

- (NSDictionary *)constantsToExport
{
  NSString *environment = [[NSBundle mainBundle] objectForInfoDictionaryKey:@"ANPushEnvironment"];
  BOOL trusted = [environment isEqualToString:@"staging"] || [environment isEqualToString:@"production"];
  NSString *apsEnvironment = nil;
#if !TARGET_OS_SIMULATOR
  NSString *profilePath = [[NSBundle mainBundle] pathForResource:@"embedded.mobileprovision" ofType:nil];
  NSURL *profileURL = profilePath ? [NSURL fileURLWithPath:profilePath] : nil;
  NSData *profileData = profileURL ? [NSData dataWithContentsOfURL:profileURL] : nil;
  NSString *profile = profileData
      ? [[NSString alloc] initWithData:profileData encoding:NSISOLatin1StringEncoding]
      : nil;
  NSRange apsKey = [profile rangeOfString:@"<key>aps-environment</key>"];
  if (apsKey.location != NSNotFound) {
    NSUInteger start = NSMaxRange(apsKey);
    NSUInteger length = MIN((NSUInteger)256, profile.length - start);
    NSString *valueWindow = [profile substringWithRange:NSMakeRange(start, length)];
    if ([valueWindow containsString:@"<string>development</string>"]) {
      apsEnvironment = @"development";
    } else if ([valueWindow containsString:@"<string>production</string>"]) {
      apsEnvironment = @"production";
    }
  } else if (!profile && [environment isEqualToString:@"production"]) {
    // App Store/TestFlight distributions do not include an embedded mobile
    // provision. Their APNs entitlement is production by contract.
    apsEnvironment = @"production";
  }
#endif
  return @{
    @"pushEnvironment": trusted ? environment : [NSNull null],
    @"apsEnvironment": apsEnvironment ?: [NSNull null]
  };
}

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

RCT_REMAP_METHOD(consumeShareIntent,
                 consumeShareIntentWithResolver:(RCTPromiseResolveBlock)resolve
                 rejecter:(RCTPromiseRejectBlock)reject)
{
  NSURL *container = [[NSFileManager defaultManager]
      containerURLForSecurityApplicationGroupIdentifier:@"group.org.adjusternetwork.app"];
  NSURL *file = [container URLByAppendingPathComponent:@"pending-share.json"];
  NSData *data = file ? [NSData dataWithContentsOfURL:file] : nil;
  if (file) [[NSFileManager defaultManager] removeItemAtURL:file error:nil];
  if (!data || data.length > 12288) {
    resolve([NSNull null]);
    return;
  }
  id decoded = [NSJSONSerialization JSONObjectWithData:data options:0 error:nil];
  if (![decoded isKindOfClass:[NSDictionary class]]) {
    resolve([NSNull null]);
    return;
  }
  NSDictionary *payload = (NSDictionary *)decoded;
  NSString *schema = payload[@"schema"];
  NSString *kind = payload[@"kind"];
  NSString *value = payload[@"value"];
  NSNumber *createdAt = payload[@"created_at"];
  NSTimeInterval age = [[NSDate date] timeIntervalSince1970] - createdAt.doubleValue;
  BOOL valid = [schema isEqualToString:@"an.share-intent.v1"] &&
      [createdAt isKindOfClass:[NSNumber class]] &&
      ([kind isEqualToString:@"url"] || [kind isEqualToString:@"text"]) &&
      value.length > 0 && value.length <= ([kind isEqualToString:@"url"] ? 2048 : 8192) &&
      age >= 0 && age <= 300;
  if (valid && [kind isEqualToString:@"url"]) {
    NSURL *url = [NSURL URLWithString:value];
    valid = [url.scheme.lowercaseString isEqualToString:@"https"] &&
        [url.host.lowercaseString isEqualToString:@"adjusternetwork.org"];
  }
  resolve(valid ? payload : [NSNull null]);
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
