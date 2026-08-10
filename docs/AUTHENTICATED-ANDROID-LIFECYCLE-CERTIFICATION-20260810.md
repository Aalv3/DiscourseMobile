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

## Final Android closeout

A second bounded production-backed exercise closed the remaining device lanes except the initial
signed-out authentication-return defect:

- The native swipe-to-remove control revoked the active User API key, removed the secure local site
  credential and token-free account metadata, cleared cookies, and returned to the signed-out
  Connect state. Force-stop/relaunch did not restore private state. The server retains only the
  expected revoked audit row, not an active key.
- A synthetic text-only topic was created successfully. The browser composer exposed no file input,
  picker, camera, or upload control; the Android manifest exposes no share receiver and removes broad
  storage permissions. The synthetic topic was permanently destroyed at close.
- A member profile exposed no Message action. A deliberately constructed direct message route could
  display the core composer, but the server rejected Send with the clear policy message that the
  user cannot be messaged; no private topic or post was created.
- TalkBack on API 35 identified three unlabeled critical controls in the authenticated home shell.
  The Adjuster Network patch now labels Add, Settings, About Discourse, the site/account row, and the
  revealed Remove account action with explicit roles. The measured tree then exposed meaningful
  names for the home navigation, Floor, Activity, and account-removal control. This is bounded device
  evidence, not a comprehensive WCAG claim.
- All synthetic identities were closed with the certified AN-037 workflow after their active keys,
  browser state, topic, temporary secrets, logs, and evidence were disposed. No invitation existed.

The remaining defect is reproducible on the exact production ESR: when a signed-out user opens the
User API Key v2 authorization URL, completes initial web authentication, and returns to the app, the
authorization screen is not resumed. A second Connect action is still required. Wrapping the URL in
a login `return_path` was tested and rejected because the deployed login flow still returned to the
public root. Automatically reopening a browser on every foreground event would make explicit cancel
and browser-close behavior untruthful, so that workaround was not shipped. Nonce consumption,
callback validation, and replay resistance remain intact.

Accordingly, AN-2703/AN-2708 authenticated Android lifecycle remains **NO-GO for production release**
on the single authentication-return UX blocker. Account removal, compose/upload/DM restrictions,
bounded authenticated TalkBack, and the previously certified security lifecycle are otherwise GO.
