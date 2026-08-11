# Native privacy and security boundary

## Current product boundary

The native app is a login-first client for the private Adjuster Network. It does not duplicate the public Concept C homepage. Before authentication it may identify Adjuster Network and start the Discourse User API Key handoff, but it must not display member/community data. Floor and Activity are the only available primary destinations. Ask, CAT, and You remain hidden until each has meaningful, authorized functionality.

The only first-party API/WebView origin is `https://adjusternetwork.org`. Other HTTPS destinations open through the operating-system browser. HTTP, JavaScript, data, file, malformed, unsupported custom-scheme, and prefix-confusable origins fail closed. The existing `discourse` callback scheme remains development compatibility only; an owner-controlled scheme and verified HTTPS App Links/Universal Links are release gates.

## Data inventory

| Class | Data | Posture |
| --- | --- | --- |
| REQUIRED | Discourse User API Key, RSA authentication key pair | Platform credential storage, device-only accessibility; deleted on account removal |
| REQUIRED | Site identity, unread counters, last path, preferences | Bounded local application metadata; no token serialization |
| OPTIONAL | Private page cache held by the OS/WebView | Session-bounded; cookies are cleared on account removal; background privacy shield |
| DEBUG | Fixed diagnostic event codes | Development only; no URLs, tokens, payloads, response bodies, email, or private content |
| DEFERRED | Push token and notification payload | Push disabled; no registration or permission prompt |
| DEFERRED | Crash reporting | Disabled; no provider activated |
| DEFERRED | Analytics/device advertising identifiers | No behavioral analytics; advertising permission removed |

Android cloud backup is disabled. Release Android traffic is HTTPS-only and WebView debugging is development-only. iOS ATS has no cleartext exception in the production plist. Active screenshots remain allowed; private UI is covered when the app becomes inactive/backgrounded so task-switcher snapshots do not casually disclose content.

## Authentication lifecycle

Authentication uses Discourse User API Key v2 in the system authentication browser. Callback authorities are exact-matched, the encrypted response nonce is verified, malformed responses fail closed, and imported keys move into Android Keystore/iOS Keychain through `react-native-keychain`. A one-time migration removes legacy token/RSA material from AsyncStorage after secure storage succeeds. Server 401/403 responses remove the rejected token from secure storage. Account removal attempts server revocation, then deletes local secure material and WebView cookies even if the server is unavailable.

No credentials, keys, callback payloads, notification payloads, or API response bodies may be included in logs or evidence.

## Notifications

Push remains disabled. A future implementation must default lock-screen previews to non-sensitive text, require authentication before following a private deep link, bind tokens to the current account/device, unregister on logout/account removal, and handle revoked accounts without continuing private delivery.

## Release identity and iOS follow-up

The owner-approved founding-beta identity is `org.adjusternetwork.app` for Android and iOS,
`org.adjusternetwork.app.ShareExtension` for the iOS extension, and the `adjusternetwork://` callback
scheme. App/Universal Links use `adjusternetwork.org` and are initially limited to topic, category and
user paths. Firebase is removed while push remains off. The owner holds both store accounts and is
the initial signing custodian; signing keys and recovery material remain outside Git and CI.

On a Mac, use the pinned Xcode/React Native toolchain, install Pods, configure a non-production signing team, and test iPhone/iPad simulators for Keychain migration/deletion, auth callback and Universal Link association, ATS, background snapshots, cache separation, VoiceOver, Dynamic Type, light/dark mode, revoked sessions, reinstall semantics, and release-log silence. No iOS runtime certification is claimed from Windows.

The User API Key callback is processed before any session handoff. Android retains the authenticated system-browser cookie session and must not reopen the callback one-time-password URL after storing the encrypted key payload. iOS keeps the one-time-password handoff because its native WebView cookie jar is separate; that platform-specific behavior requires Mac/Xcode runtime certification. Rejected, stale, malformed, or replayed payloads must never continue to either handoff.

## Upstream maintenance

The Adjuster Network patch layer is intentionally concentrated in configuration, security/credential modules, `Site`/`SiteManager`, top-level navigation, WebView policy, manifests, tests, and these documents. Authentication, navigation, WebView, Firebase/push, and manifest changes are expected upstream conflict areas.

To sync: fetch `upstream`, review its authentication/storage and React Native changes, merge into the development branch, resolve only the bounded patch layer, reinstall with the immutable lockfile, then run formatting, lint, unit/contract tests, Android lint/build, emulator deep-link and restricted-state checks, and a log/evidence redaction scan.
