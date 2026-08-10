# Authenticated Android lifecycle certification — 2026-08-10

## Scope and disposition

This bounded API 35 production-backed exercise used only minimum-privilege identities marked
`synthetic_fixture`. No invitation was created. The identities, User API keys, browser sessions,
private isolation probe, local credentials, screenshots, UI dumps, and runtime logs were disposed
at close. The certified AN-037 workflow closed every temporary account. Production returned to zero
real members and zero valid invitations.

## Measured results

- Real Discourse User API Key v2 browser login and approval created one encrypted callback and one
  active server key. The app stored the key in Android device-only credential storage; token-free
  account metadata remained in AsyncStorage.
- Force-stop/relaunch restored the authenticated site. Server key revocation removed the local
  credential and returned the site to its signed-out Connect state. Private activity was absent.
- Account A metadata and its private-message isolation probe did not appear after account B login.
  AsyncStorage contained B metadata, no A metadata, no probe content, and no `authToken` field.
- Uninstall/reinstall removed Keystore-backed credentials, AsyncStorage, cookies, caches, and site
  metadata. Relaunch was truthfully signed out. A server key stranded by uninstall was revoked during
  fixture disposition.
- Approval cancellation created no User API key. Missing/malformed callbacks, a prefix-confusable
  callback host, unsupported schemes, unsafe shared URLs, and signed-out private navigation did not
  disclose the isolation probe.
- Android recents showed the app's bounded non-content shell, not topic/profile/message content, and
  foreground restoration remained usable.
- The production backend retained uploads-disabled, member-DM restriction, invite-only/login-required
  admission, non-collecting Request to Join, public-home v1, NWS-only public intelligence, and private
  shadow-provider controls.

## Defect remediated

`SiteManager.handleAuthPayload` retained the pending nonce after a successful callback. The callback
is now consumed before decrypt/validation, so malformed, mismatched, and replayed callbacks require a
fresh authorization attempt. A deterministic one-shot regression test covers the invariant.

## Validation

- Prettier: PASS
- ESLint: PASS
- Jest: 12 suites / 41 tests PASS
- Backend shared-contract probe: PASS
- Android `lintDebug`: PASS
- Android `assembleDebug`: PASS on the short `N:` path with API 35/JDK 17
- Real API 35 login, approval, secure persistence, relaunch, server revocation, cross-account
  isolation, reinstall, private-route denial, and recents privacy: PASS as described above
- Zero-member posture: 8/8 PASS
- Admission readiness: 10/10 PASS

## Honest limits and verdict

The app's own account-removal control was not completed end to end after the remediation build; the
attempted final fixture never obtained a key and was safely closed. A byte-for-byte real callback
replay was intentionally not captured because retaining the encrypted callback would create an auth
artifact; the one-shot logic is covered deterministically instead. Compose/upload/DM restrictions
were certified at the backend boundary but not through every native/browser affordance. Bounded
TalkBack authenticated-flow evidence was not completed.

Accordingly, AN-2703/AN-2708 authenticated Android lifecycle remains **NO-GO for production release**
until a follow-up device wave completes app-initiated removal/logout, authenticated TalkBack, and the
native/browser compose-upload-DM negative matrix. This does not invalidate the security remediation
or the lifecycle results above.
