# AN-2703 / AN-2708 certification

Date: 2026-08-10

Scope: native privacy/security and navigation foundation only. No production app release and no backend mutation.

Implemented: platform credential storage with legacy migration; token-free AsyncStorage serialization; rejected-token and account-removal cleanup including WebView cookies; bounded callback validation and nonce checks; canonical-origin WebView/API boundary; system-browser external links; HTTPS-only release networking; development-only WebView debugging; disabled push, analytics, and crash reporting; removal of Android advertising/camera/Bluetooth permission requests; background task-switcher privacy shield; Floor/Activity-only navigation; iOS release-safe ATS/display metadata preparation; and adversarial unit tests.

Validation: Prettier, ESLint, 11 Jest suites / 40 tests, live read-only backend contract, Android `lintDebug`, Android `assembleDebug`, install/launch on API 35, selected-state navigation, malformed callback and unsupported route fail-closed checks, force-stop/relaunch, light/dark, and runtime-log redaction inspection. Runtime evidence is retained outside the repository. No real credentials were used. Auth success/revocation/logout and cross-account cache checks are covered structurally/unit-level only until a synthetic private test account is authorized.

Not certified on Windows: iOS runtime/VoiceOver/Keychain behavior, store identifiers/signing, HTTPS Universal Links/App Links, release build signing, real revoked-session behavior, reinstall semantics, authenticated cache crossover, and production push (which remains disabled).
