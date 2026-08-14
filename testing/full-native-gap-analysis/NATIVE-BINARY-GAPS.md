# Native binary gaps

## NATIVE-P0

### Production APNs boundary

- Source entitlement: `aps-environment = development`.
- JavaScript push environment: `staging` with explicit APNs sandbox commentary.
- Build 1 must have a production build configuration/profile and production backend environment.
- This cannot be corrected by JavaScript OTA after submission.

### Share Extension contract

- The extension calls `UIApplication.shared` through KVC to open the containing app.
- The activation rule advertises up to ten images, while implementation accepts only URL/text.
- Shared values are interpolated into a query without explicit percent encoding.
- There is no visible error state before the extension dismisses.
- Replace with an App-Group/extension-safe handoff and align activation types before Build 1.

## NATIVE-P1

### Hermes symbols

Apple validation previously passed with a warning, but the matching `hermes.framework` dSYM remains
missing. Include it in the one final replacement archive.

### Launch identity

`LaunchScreen.xib` references `img/nav-icon-gray@3x.png`, the stock Discourse bubble. Replace with
the existing approved compact Adjuster Network mark and validate light/dark launch transitions.

### Privacy manifest reconciliation

The project contains both `ios/PrivacyInfo.xcprivacy` and the app-target
`ios/Discourse/PrivacyInfo.xcprivacy`; their accessed-API reason sets differ, and both declare an
empty collected-data list. Produce one authoritative app manifest consistent with SDK manifests,
actual network/device processing, and App Store privacy answers.

## Verified native boundaries

- Display name and identifiers: Adjuster Network / `org.adjusternetwork.app` / version 1.0.0 build 1.
- Associated domain source entitlement: `applinks:adjusternetwork.org`.
- Live AASA returned HTTP 200 JSON and matched Team/App ID `2GB8G74L4H.org.adjusternetwork.app`
  with `/t/*`, `/c/*`, and `/u/*` paths.
- ATS arbitrary loads disabled.
- Keychain-backed credentials and the separate A3 installation identity remain present.
- OTA uses runtime `an-ios-android-1.0.0-native-1`, production/staging channel declarations,
  embedded recovery, and anti-bricking enabled.
- App icon catalog contains the approved universal 1024×1024 asset.

