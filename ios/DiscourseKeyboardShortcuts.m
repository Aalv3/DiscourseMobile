#import "DiscourseKeyboardShortcuts.h"
#import <Security/Security.h>
#import <TargetConditionals.h>
#import <UIKit/UIKit.h>
#import <UserNotifications/UserNotifications.h>
#import <os/log.h>

@implementation DiscourseKeyboardShortcuts

static NSString *pendingAPNSToken = nil;
static BOOL pendingAPNSRegistrationFailure = NO;

+ (void)storeAPNSToken:(NSData *)deviceToken
{
  const unsigned char *bytes = deviceToken.bytes;
  NSMutableString *token = [NSMutableString stringWithCapacity:deviceToken.length * 2];
  for (NSUInteger index = 0; index < deviceToken.length; index++) {
    [token appendFormat:@"%02x", bytes[index]];
  }
  @synchronized(self) {
    pendingAPNSToken = [token copy];
    pendingAPNSRegistrationFailure = NO;
  }
}

+ (void)storeAPNSRegistrationFailure
{
  @synchronized(self) {
    pendingAPNSToken = nil;
    pendingAPNSRegistrationFailure = YES;
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

static NSString *trustedAPSEnvironmentFromEntitlement(CFTypeRef entitlement)
{
  if (!entitlement || CFGetTypeID(entitlement) != CFStringGetTypeID()) {
    return nil;
  }

  NSString *environment = (__bridge NSString *)entitlement;
  if ([environment isEqualToString:@"development"] ||
      [environment isEqualToString:@"production"]) {
    return environment;
  }
  return nil;
}

- (NSDictionary *)constantsToExport
{
  NSString *environment = [[NSBundle mainBundle] objectForInfoDictionaryKey:@"ANPushEnvironment"];
  BOOL trusted = [environment isEqualToString:@"staging"] || [environment isEqualToString:@"production"];
  NSString *apsEnvironment = nil;
#if !TARGET_OS_SIMULATOR
  SecTaskRef task = SecTaskCreateFromSelf(kCFAllocatorDefault);
  if (task) {
    CFTypeRef entitlement = SecTaskCopyValueForEntitlement(
        task, CFSTR("aps-environment"), NULL);
    apsEnvironment = trustedAPSEnvironmentFromEntitlement(entitlement);
    if (entitlement) {
      CFRelease(entitlement);
    }
    CFRelease(task);
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

RCT_EXPORT_METHOD(recordPushRegistrationResult:(NSDictionary *)result)
{
  static NSSet<NSString *> *stages;
  static NSSet<NSString *> *categories;
  static NSSet<NSString *> *statusClasses;
  static NSSet<NSString *> *outcomes;
  static dispatch_once_t onceToken;
  dispatch_once(&onceToken, ^{
    stages = [NSSet setWithArray:@[@"permission_check", @"permission_request", @"apns_token",
      @"installation_identity", @"nonce_generation", @"backend_transport", @"backend_response",
      @"preference_persistence", @"completed", @"unknown"]];
    categories = [NSSet setWithArray:@[@"started", @"stage_succeeded", @"enabled", @"permission_denied", @"permission_failure",
      @"apns_token_failure", @"installation_identity_failure", @"nonce_failure", @"network_failure",
      @"backend_rejection", @"backend_rate_limited", @"preference_persistence_failure",
      @"unknown_registration_failure"]];
    statusClasses = [NSSet setWithArray:@[@"2xx", @"4xx", @"429", @"5xx", @"none"]];
    outcomes = [NSSet setWithArray:@[@"started", @"succeeded", @"failed"]];
  });
  NSString *stage = result[@"stage"];
  NSString *category = result[@"category"];
  NSString *statusClass = result[@"httpStatusClass"];
  NSString *outcome = result[@"outcome"];
  if (![stages containsObject:stage] || ![categories containsObject:category] ||
      ![statusClasses containsObject:statusClass] || ![outcomes containsObject:outcome]) return;
  os_log_with_type(OS_LOG_DEFAULT, OS_LOG_TYPE_INFO,
    "ANPushRegistration stage=%{public}@ category=%{public}@ http=%{public}@ outcome=%{public}@",
    stage, category, statusClass, outcome);
}

static NSString *ANAuthorizationState(UNAuthorizationStatus status)
{
  switch (status) {
    case UNAuthorizationStatusNotDetermined:
      return @"notDetermined";
    case UNAuthorizationStatusDenied:
      return @"denied";
    case UNAuthorizationStatusAuthorized:
      return @"authorized";
    case UNAuthorizationStatusProvisional:
      return @"provisional";
#if __IPHONE_OS_VERSION_MAX_ALLOWED >= 140000
    case UNAuthorizationStatusEphemeral:
      return @"ephemeral";
#endif
    default:
      return @"unknown";
  }
}

RCT_REMAP_METHOD(notificationAuthorizationState,
                 notificationAuthorizationStateWithResolver:(RCTPromiseResolveBlock)resolve
                 rejecter:(RCTPromiseRejectBlock)reject)
{
  [[UNUserNotificationCenter currentNotificationCenter]
      getNotificationSettingsWithCompletionHandler:^(UNNotificationSettings *settings) {
    resolve(ANAuthorizationState(settings.authorizationStatus));
  }];
}

RCT_REMAP_METHOD(requestNotificationAuthorization,
                 requestNotificationAuthorizationWithResolver:(RCTPromiseResolveBlock)resolve
                 rejecter:(RCTPromiseRejectBlock)reject)
{
  UNAuthorizationOptions options = UNAuthorizationOptionAlert |
      UNAuthorizationOptionBadge | UNAuthorizationOptionSound;
  [[UNUserNotificationCenter currentNotificationCenter]
      requestAuthorizationWithOptions:options
      completionHandler:^(BOOL granted, NSError *error) {
    if (error) {
      reject(@"notification_authorization_failed",
        @"Notification authorization could not complete", nil);
      return;
    }
    [[UNUserNotificationCenter currentNotificationCenter]
        getNotificationSettingsWithCompletionHandler:^(UNNotificationSettings *settings) {
      resolve(ANAuthorizationState(settings.authorizationStatus));
    }];
  }];
}

RCT_EXPORT_METHOD(registerForRemoteNotifications)
{
  dispatch_async(dispatch_get_main_queue(), ^{
    [[UIApplication sharedApplication] registerForRemoteNotifications];
  });
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

RCT_REMAP_METHOD(consumeAPNSRegistrationFailure,
                 consumeAPNSRegistrationFailureWithResolver:(RCTPromiseResolveBlock)resolve
                 rejecter:(RCTPromiseRejectBlock)reject)
{
  BOOL failed = NO;
  @synchronized([self class]) {
    failed = pendingAPNSRegistrationFailure;
    pendingAPNSRegistrationFailure = NO;
  }
  resolve(@(failed));
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
