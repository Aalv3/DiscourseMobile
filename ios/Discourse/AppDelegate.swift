import Expo
import React
import ReactAppDependencyProvider
import UserNotifications

@main
public class AppDelegate: ExpoAppDelegate, UNUserNotificationCenterDelegate {
  var window: UIWindow?
  private var reactNativeDelegate: ExpoReactNativeFactoryDelegate?
  private var reactNativeFactory: RCTReactNativeFactory?

  public override func application(
    _ application: UIApplication,
    didFinishLaunchingWithOptions launchOptions: [UIApplication.LaunchOptionsKey: Any]? = nil
  ) -> Bool {
    let delegate = ReactNativeDelegate()
    let factory = ExpoReactNativeFactory(delegate: delegate)
    delegate.dependencyProvider = RCTAppDependencyProvider()
    reactNativeDelegate = delegate
    reactNativeFactory = factory
    bindReactNativeFactory(factory)

    UNUserNotificationCenter.current().delegate = self
    window = UIWindow(frame: UIScreen.main.bounds)
    factory.startReactNative(
      withModuleName: "Discourse",
      in: window,
      launchOptions: launchOptions
    )
    UNUserNotificationCenter.current().getNotificationSettings { settings in
      let authorizationState: String
      switch settings.authorizationStatus {
      case .authorized, .provisional, .ephemeral:
        authorizationState = "granted"
      case .denied:
        authorizationState = "denied"
      case .notDetermined:
        authorizationState = "not_determined"
      @unknown default:
        authorizationState = "unknown"
      }
      guard authorizationState == "granted" else { return }
      DispatchQueue.main.async {
        application.registerForRemoteNotifications()
      }
    }
    return super.application(application, didFinishLaunchingWithOptions: launchOptions)
  }

  public override func application(
    _ app: UIApplication,
    open url: URL,
    options: [UIApplication.OpenURLOptionsKey: Any] = [:]
  ) -> Bool {
    super.application(app, open: url, options: options)
      || RCTLinkingManager.application(app, open: url, options: options)
  }

  public override func application(
    _ application: UIApplication,
    continue userActivity: NSUserActivity,
    restorationHandler: @escaping ([UIUserActivityRestoring]?) -> Void
  ) -> Bool {
    let linked = RCTLinkingManager.application(
      application,
      continue: userActivity,
      restorationHandler: restorationHandler
    )
    return super.application(
      application,
      continue: userActivity,
      restorationHandler: restorationHandler
    ) || linked
  }

  public override var keyCommands: [UIKeyCommand]? {
    var commands: [UIKeyCommand] = []
    let menuItems = UserDefaults.standard.stringArray(forKey: "menuItems") ?? []
    for (offset, title) in menuItems.prefix(9).enumerated() {
      let key = String(offset + 1)
      commands.append(UIKeyCommand(
        input: key,
        modifierFlags: .command,
        action: Selector("send\(key)"),
        discoverabilityTitle: title
      ))
    }
    commands.append(UIKeyCommand(
      input: "W",
      modifierFlags: .command,
      action: #selector(sendW),
      discoverabilityTitle: "Dismiss"
    ))
    return commands
  }

  public override func buildMenu(with builder: UIMenuBuilder) {
    builder.remove(menu: .format)
    builder.remove(menu: .view)
    builder.remove(menu: .help)
    builder.replaceChildren(ofMenu: .file) { [weak self] _ in self?.keyCommands ?? [] }
  }

  @objc private func send1() { sendKey("1") }
  @objc private func send2() { sendKey("2") }
  @objc private func send3() { sendKey("3") }
  @objc private func send4() { sendKey("4") }
  @objc private func send5() { sendKey("5") }
  @objc private func send6() { sendKey("6") }
  @objc private func send7() { sendKey("7") }
  @objc private func send8() { sendKey("8") }
  @objc private func send9() { sendKey("9") }
  @objc private func sendW() { sendKey("W") }

  private func sendKey(_ input: String) {
    DiscourseKeyboardShortcuts().sendEvent(input)
  }

  public override func application(
    _ application: UIApplication,
    didRegisterForRemoteNotificationsWithDeviceToken deviceToken: Data
  ) {
    DiscourseKeyboardShortcuts.storeAPNSToken(deviceToken)
    RNCPushNotificationIOS.didRegisterForRemoteNotifications(withDeviceToken: deviceToken)
    super.application(application, didRegisterForRemoteNotificationsWithDeviceToken: deviceToken)
  }

  public override func application(
    _ application: UIApplication,
    didReceiveRemoteNotification userInfo: [AnyHashable: Any],
    fetchCompletionHandler completionHandler: @escaping (UIBackgroundFetchResult) -> Void
  ) {
    RNCPushNotificationIOS.didReceiveRemoteNotification(
      userInfo,
      fetchCompletionHandler: completionHandler
    )
  }

  public override func application(
    _ application: UIApplication,
    performFetchWithCompletionHandler completionHandler: @escaping (UIBackgroundFetchResult) -> Void
  ) {
    ANPerformBackgroundFetch(application, completionHandler)
  }

  public override func application(
    _ application: UIApplication,
    didFailToRegisterForRemoteNotificationsWithError error: Error
  ) {
    DiscourseKeyboardShortcuts.storeAPNSRegistrationFailure()
    RNCPushNotificationIOS.didFailToRegisterForRemoteNotificationsWithError(error)
    super.application(application, didFailToRegisterForRemoteNotificationsWithError: error)
  }

  public func userNotificationCenter(
    _ center: UNUserNotificationCenter,
    willPresent notification: UNNotification
  ) async -> UNNotificationPresentationOptions {
    [.sound, .list, .banner, .badge]
  }

  public func userNotificationCenter(
    _ center: UNUserNotificationCenter,
    didReceive response: UNNotificationResponse
  ) async {
    var userData = response.notification.request.content.userInfo
    userData["openedInForeground"] = 1
    await MainActor.run {
      RNCPushNotificationIOS.didReceiveRemoteNotification(userData)
    }
  }
}

private class ReactNativeDelegate: ExpoReactNativeFactoryDelegate {
  override func sourceURL(for bridge: RCTBridge) -> URL? {
    bridge.bundleURL ?? bundleURL()
  }

  override func bundleURL() -> URL? {
#if DEBUG
    RCTBundleURLProvider.sharedSettings().jsBundleURL(forBundleRoot: ".expo/.virtual-metro-entry")
#else
    Bundle.main.url(forResource: "main", withExtension: "jsbundle")
#endif
  }
}
