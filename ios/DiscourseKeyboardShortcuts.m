#import "DiscourseKeyboardShortcuts.h"
#import <Security/Security.h>
#import <UIKit/UIKit.h>
#import <UserNotifications/UserNotifications.h>
#import <os/log.h>

@implementation DiscourseKeyboardShortcuts

static NSString *pendingAPNSToken = nil;
static BOOL pendingAPNSRegistrationFailure = NO;

static void ANRemoveExpiredSharedImages(NSURL *container)
{
  if (!container) return;
  NSFileManager *files = [NSFileManager defaultManager];
  NSArray<NSURL *> *contents = [files contentsOfDirectoryAtURL:container
                                   includingPropertiesForKeys:@[NSURLContentModificationDateKey]
                                                      options:NSDirectoryEnumerationSkipsHiddenFiles
                                                        error:nil];
  NSDate *cutoff = [NSDate dateWithTimeIntervalSinceNow:-600];
  NSRegularExpression *pattern = [NSRegularExpression regularExpressionWithPattern:@"^shared-image-[0-9a-f-]{36}\\.(jpe?g|png|heic|heif|gif|webp)$" options:NSRegularExpressionCaseInsensitive error:nil];
  for (NSURL *candidate in contents) {
    NSString *name = candidate.lastPathComponent;
    if ([pattern numberOfMatchesInString:name options:0 range:NSMakeRange(0, name.length)] != 1) continue;
    NSDate *modified = nil;
    [candidate getResourceValue:&modified forKey:NSURLContentModificationDateKey error:nil];
    if (modified && [modified compare:cutoff] == NSOrderedAscending) {
      [files removeItemAtURL:candidate error:nil];
    }
  }
}

static void ANPersistPushDiagnostic(NSString *stage, NSString *category,
                                    NSString *statusClass, NSString *outcome)
{
  NSFileManager *files = [NSFileManager defaultManager];
  NSURL *support = [files URLsForDirectory:NSApplicationSupportDirectory
                                 inDomains:NSUserDomainMask].firstObject;
  if (!support) return;
  NSURL *directory = [support URLByAppendingPathComponent:@"AdjusterNetworkDiagnostics"
                                               isDirectory:YES];
  [files createDirectoryAtURL:directory
   withIntermediateDirectories:YES
                    attributes:@{NSFileProtectionKey: NSFileProtectionCompleteUntilFirstUserAuthentication}
                         error:nil];
  NSURL *url = [directory URLByAppendingPathComponent:@"push-registration.ndjson"];
  NSDictionary *entry = @{
    @"timestamp": @((long long)(NSDate.date.timeIntervalSince1970 * 1000)),
    @"stage": stage,
    @"category": category,
    @"http": statusClass,
    @"outcome": outcome
  };
  NSData *json = [NSJSONSerialization dataWithJSONObject:entry options:0 error:nil];
  if (!json) return;
  NSMutableData *bounded = [NSMutableData data];
  NSData *existing = [NSData dataWithContentsOfURL:url];
  if (existing.length > 65536) {
    NSRange tail = NSMakeRange(existing.length - 65536, 65536);
    existing = [existing subdataWithRange:tail];
    const uint8_t *bytes = existing.bytes;
    NSUInteger firstLine = 0;
    while (firstLine < existing.length && bytes[firstLine] != '\n') firstLine++;
    if (firstLine < existing.length) {
      existing = [existing subdataWithRange:NSMakeRange(firstLine + 1, existing.length - firstLine - 1)];
    }
  }
  if (existing) [bounded appendData:existing];
  [bounded appendData:json];
  [bounded appendBytes:"\n" length:1];
  [bounded writeToURL:url options:NSDataWritingAtomic | NSDataWritingFileProtectionCompleteUntilFirstUserAuthentication error:nil];
}

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

- (NSDictionary *)constantsToExport
{
  NSString *environment = [[NSBundle mainBundle] objectForInfoDictionaryKey:@"ANPushEnvironment"];
  BOOL trusted = [environment isEqualToString:@"staging"] || [environment isEqualToString:@"production"];
  return @{ @"pushEnvironment": trusted ? environment : [NSNull null] };
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
  ANPersistPushDiagnostic(stage, category, statusClass, outcome);
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
  ANRemoveExpiredSharedImages(container);
  NSURL *file = [container URLByAppendingPathComponent:@"pending-share.json"];
  NSData *data = file ? [NSData dataWithContentsOfURL:file] : nil;
  if (!data || data.length > 4096) {
    if (file) [[NSFileManager defaultManager] removeItemAtURL:file error:nil];
    resolve([NSNull null]);
    return;
  }
  id decoded = [NSJSONSerialization JSONObjectWithData:data options:0 error:nil];
  if (![decoded isKindOfClass:[NSDictionary class]]) {
    if (file) [[NSFileManager defaultManager] removeItemAtURL:file error:nil];
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
      ([kind isEqualToString:@"url"] || [kind isEqualToString:@"text"] || [kind isEqualToString:@"image"]) &&
      value.length > 0 && value.length <= ([kind isEqualToString:@"url"] ? 2048 : 8192) &&
      age >= 0 && age <= 300;
  if (valid && [kind isEqualToString:@"url"]) {
    NSURL *url = [NSURL URLWithString:value];
    valid = [url.scheme.lowercaseString isEqualToString:@"https"] &&
        [url.host.lowercaseString isEqualToString:@"adjusternetwork.org"];
  }
  NSMutableDictionary *result = [payload mutableCopy];
  if (valid && [kind isEqualToString:@"image"]) {
    NSString *name = payload[@"name"];
    NSString *mimeType = payload[@"mime_type"];
    NSNumber *size = payload[@"size"];
    NSRegularExpression *pattern = [NSRegularExpression regularExpressionWithPattern:@"^shared-image-[0-9a-f-]{36}\\.(jpe?g|png|heic|heif|gif|webp)$" options:NSRegularExpressionCaseInsensitive error:nil];
    NSSet *mimeTypes = [NSSet setWithArray:@[@"image/jpeg", @"image/png", @"image/heic", @"image/heif", @"image/gif", @"image/webp"]];
    BOOL safeFilename = value.length <= 128 && [pattern numberOfMatchesInString:value options:0 range:NSMakeRange(0, value.length)] == 1;
    NSURL *imageURL = safeFilename ? [container URLByAppendingPathComponent:value isDirectory:NO] : nil;
    NSDictionary *attributes = imageURL ? [[NSFileManager defaultManager] attributesOfItemAtPath:imageURL.path error:nil] : nil;
    unsigned long long actualSize = [attributes fileSize];
    valid = safeFilename && [name isKindOfClass:[NSString class]] && name.length > 0 && name.length <= 128 &&
        [mimeType isKindOfClass:[NSString class]] && [mimeTypes containsObject:mimeType] &&
        [size isKindOfClass:[NSNumber class]] && size.unsignedLongLongValue == actualSize &&
        actualSize > 0 && actualSize <= 15 * 1024 * 1024 &&
        [attributes[NSFileType] isEqualToString:NSFileTypeRegular];
    if (valid) result[@"uri"] = imageURL.absoluteString;
    if (!valid && imageURL) [[NSFileManager defaultManager] removeItemAtURL:imageURL error:nil];
  }
  if (file) [[NSFileManager defaultManager] removeItemAtURL:file error:nil];
  resolve(valid ? result : [NSNull null]);
}

RCT_REMAP_METHOD(discardSharedImage,
                 discardSharedImageNamed:(NSString *)filename
                 resolver:(RCTPromiseResolveBlock)resolve
                 rejecter:(RCTPromiseRejectBlock)reject)
{
  NSRegularExpression *pattern = [NSRegularExpression regularExpressionWithPattern:@"^shared-image-[0-9a-f-]{36}\\.(jpe?g|png|heic|heif|gif|webp)$" options:NSRegularExpressionCaseInsensitive error:nil];
  BOOL safe = filename.length <= 128 && [pattern numberOfMatchesInString:filename options:0 range:NSMakeRange(0, filename.length)] == 1;
  NSURL *container = [[NSFileManager defaultManager] containerURLForSecurityApplicationGroupIdentifier:@"group.org.adjusternetwork.app"];
  BOOL removed = safe && container && [[NSFileManager defaultManager] removeItemAtURL:[container URLByAppendingPathComponent:filename] error:nil];
  resolve(@(removed));
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
