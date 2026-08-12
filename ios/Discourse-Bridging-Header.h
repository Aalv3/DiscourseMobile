#import <Expo/Expo.h>
#import <RNCPushNotificationIOS.h>
#import <TSBackgroundFetch/TSBackgroundFetch.h>
#import "DiscourseKeyboardShortcuts.h"

static inline void ANPerformBackgroundFetch(
  UIApplication *application,
  void (^completionHandler)(UIBackgroundFetchResult)
) {
  [[TSBackgroundFetch sharedInstance]
    performFetchWithCompletionHandler:completionHandler
    applicationState:application.applicationState];
}
//
//  Use this file to import your target's public headers that you would like to expose to Swift.
//
