# Native stale-identity authorization fix

Recorded: 2026-09-02 (America/New_York)  
Base lineage: `fdb83141879f7b1df60d46a488343563d3bb156e`
(`fix/auth-failure-classification-20260830`), the commit currently live on both
the `production` and `staging` OTA channels  
Lane: `system` (auth boundary)

## Base correction

This fix was first written on `codex/notification-tap-routing` (`879bea6a`).
A read-only channel check before staging showed that branch is not the live
lineage: it forks from the shared ancestor `126ec8e7` and omits the 44 commits
that reached production on 2026-09-01, including the Build 8 submission commit
`2eb3ef6c`, the host-qualified authorization redirect, server-verified
authorization profiles, onboarding gates, and the share-extension work. Staging
that branch would have published a 44-commit regression to the certification
channel. The fix was therefore cherry-picked onto `fdb83141`, and its tests were
updated to the current governed contracts. The defect was confirmed still
present on `fdb83141` before the cherry-pick.

## Defect

Server/E2E evidence commit `35d9d27` proved a production native authorization
defect: a stale `ASWebAuthenticationSession` identity survived app delete and
reinstall. Physical TestFlight Build 8 production testing confirmed the auth
session reused `qa_test` instead of allowing `cert_probe_01` to sign in.

`ASWebAuthenticationSession` defaults to the shared system Safari data store.
Deleting the app clears the app container and `AsyncStorage` (and therefore the
client ID, RSA keys, nonce, and stored User API Key), but it does not clear the
shared Safari cookie jar. The reinstalled app therefore presented an
already-authenticated Discourse session and bound the new User API Key to the
previous account without ever prompting for credentials.

Web and server lifecycle behavior was already certified; production server
release `228ab5bc8d77c3e89f9b520aba79748bbefa6fb5` is unchanged by this work.

## Call site

The flow is **native Swift/Objective-C `ASWebAuthenticationSession`**, not
Expo/JS `WebBrowser.openAuthSessionAsync`. `expo-web-browser` is not a
dependency of this project.

| Layer                       | File                                                                                                                                      |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Product entry points        | `js/Discourse.js:344`, `js/Discourse.js:730`, `js/screens/HomeScreen.js:78`, `js/screens/WebViewScreenComponents/WebViewComponent.js:456` |
| Authorization orchestration | `js/site_manager.js` — `requestAuth()`                                                                                                    |
| JS bridge wrapper           | `js/iosAuthSession.js` — `requestIOSAuth()`                                                                                               |
| Native bridge               | `vendor/react-native-safari-web-auth/ios/SafariWebAuth.mm`                                                                                |

The native bridge already accepted an `ephemeral` argument and already applied
it as `session.prefersEphemeralWebBrowserSession = ephemeral`. The defect was
entirely in JavaScript: `js/site_manager.js` passed a hardcoded `false`, and
`requestIOSAuth` defaulted the flag to `false`.

## Fix

`js/iosAuthSession.js` now exports `EPHEMERAL_AUTH_SESSION = true` and always
passes it to the native bridge. The flag is no longer a caller-supplied
parameter, so no call site can reintroduce a persistent shared-Safari session.
`js/site_manager.js` calls `requestIOSAuth(url, this.customScheme)`.

Preserved unchanged:

- the governed `AUTH_REDIRECT` callback contract
  (`adjusternetwork://adjusternetwork.org/auth_redirect`) and its
  `isSafeAuthCallback` allowlist;
- the one-shot nonce/client-ID binding in `handleAuthPayload`, including its
  server-verified `/native/v1/authorization-profile` exact-match check and the
  restore-previous-authorization path;
- `generateAuthURL`'s canonical-origin admission check;
- channel-derived, fail-closed production/staging environment resolution;
- scopes, policy, and User API authorization.

No separate "Use a different account" control is required. Because every
authorization now begins in a fresh ephemeral browser-auth context, the browser
never carries a prior identity into a new attempt, so a member cannot be trapped
behind a stale one. The existing `Log out of this device` control in
`PrivacyAccountScreen` remains the in-session account-switch path; it revokes
the User API Key, removes the stored token, and clears cookies.

## OTA or binary: OTA

This is OTA-shippable on the existing runtime `an-ios-android-1.0.0-native-2`.
The ruling is based on inspection of the shipped artifact, not on inference:

- Build 8 submitted source `2eb3ef6c6783181d30a59a2783e42f7c723a2769` already
  contains `ephemeral:(BOOL)ephemeral` and
  `session.prefersEphemeralWebBrowserSession = ephemeral` in `SafariWebAuth.mm`.
- The Build 8 archive executable
  (`~/Library/Developer/Xcode/Archives/2026-08-20/AdjusterNetwork-1.0-8.xcarchive`)
  exports the selector `requestAuth:callbackURLScheme:ephemeral:resolver:rejecter:`
  and references `setPrefersEphemeralWebBrowserSession:`.

The fix therefore changes only a JavaScript argument value inside an unchanged
JS/native interface. Per `docs/NATIVE-OTA-OPERATIONS.md` this stays inside the
existing runtime contract: no native source, dependency, entitlement,
permission, capability, Expo module, or interface change, and no runtime version
bump. `app.config.js` and `eas.json` are untouched.

## Tests

`js/__tests__/authEphemeralSession.test.js` (14 tests, green on `fdb83141`
alongside the full suite at 89 suites / 614 tests):

- the auth session is launched ephemerally, and the `SiteManager` call site
  cannot opt out;
- no source path can request a persistent shared-Safari session;
- the shipped native bridge honours the flag on an unchanged interface;
- a replayed or nonce-mismatched prior-account payload binds nothing, and a
  rejected payload fails the authorization instead of silently continuing;
- signing in as account B binds the User API Key to B and leaves A untouched;
- the callback stays restricted to the governed `AUTH_REDIRECT`, and the
  pre-hardening unqualified `adjusternetwork://auth_redirect` is rejected;
- production/staging environment resolution is unchanged and fail-closed,
  including the canonical-origin admission check on `generateAuthURL`.

`scripts/verify-ios-auth-presentation.mjs` gained two native assertions so a
future native regression away from the ephemeral context fails the verifier.

## Pre-push audit

- `yarn format:check`, `yarn lint`: PASS
- `yarn test:unit --runInBand`: 60 suites, 417 tests, PASS
- `yarn verify:ota`: 17/17 PASS
- `yarn verify:ios-auth`: 12/12 PASS
- `scripts/native-devex-native.mjs --configuration=Release`: BUILD SUCCEEDED
- `yarn native:lane` classifies the change as the `system` lane
- `yarn validate:system`: PASS, evidence at
  `.local/evidence/native-devex/last-run.json`

The first system-lane run failed inside `ReactCodegen` with missing
`ios/build/generated/**` inputs. That is the known React Native codegen
script-phase race, not a product regression: the artifacts are present, the
change touches no native source, and an immediate rerun of the identical native
build succeeded.

The three GitHub workflows (`linting`, `jest-tests`, `ios-tests`) only trigger
on `pull_request` or a push to `main`. This branch is the working trunk, more
than a hundred commits ahead of `main`, and no pull request exists for it, so
the push did not start a run. `yarn lint`, `yarn format:check` and
`yarn test:unit` — the complete `linting` and `jest-tests` job commands — were
run locally and pass. The `ios-tests` Detox simulator suite has not been run;
opening a pull request against `main` to trigger it is a release-picture
decision for the founder, not a CI convenience, and per `AGENTS.md` simulator
evidence could not certify this native API behavior in any case.

`PHYSICAL_REQUIRED` remains open by design. The system lane requires physical
device evidence, which is the founder's `cert_probe_01` retest below.

## Founder action required

Production OTA promotion is not performed. It needs founder authorization, and
`testing/native-app-store-readiness/POST-SUBMISSION-HOLD.md` additionally
freezes production OTA repointing while Apple review of Build 8 is underway.

Governed promotion path once authorized:

0. Commit or stash the working tree. `yarn ota:stage` refuses a dirty tree, and
   the repository still carries pre-existing uncommitted Build 8 certification
   evidence (`testing/native-app-store-readiness/`,
   `testing/native-media-attachments/`) that is not this lane's work to commit.

1. `yarn ota:stage` — publishes to the `staging` channel. A dry run confirms the
   exact command it will issue for this fix:

   ```
   npx eas-cli@latest update --branch staging --platform all \
     --message "Staging <first 12 of HEAD>" --non-interactive
   ```

   with `AN_OTA_CHANNEL=staging` and `AN_OTA_GIT_SHA=<HEAD>`, both derived
   automatically. Verify with `yarn ota:stage --dry-run` first.

2. Physically certify on the permanent staging app with `cert_probe_01`:
   install, sign in, sign out, delete the app, reinstall, and confirm the
   authorization prompt asks for credentials and does not reuse `qa_test`.
3. `yarn ota:promote --group=<certified EAS group UUID>` — republishes that
   exact certified update group to `production`. Do not rebundle.

Live channel state read on 2026-09-02, which supersedes the group recorded in
`testing/native-app-store-readiness/POST-SUBMISSION-HOLD.md`:

| Channel    | Group                                  | Source SHA     | Runtime                         | Published  |
| ---------- | -------------------------------------- | -------------- | ------------------------------- | ---------- |
| production | `70eebadf-5736-4cd6-a7db-2980a69f0494` | `fdb83141879f` | `an-ios-android-1.0.0-native-2` | 2026-09-01 |
| staging    | `4fbf12ad-69f3-47a0-b88a-7238bde5214c` | `fdb83141879f` | `an-ios-android-1.0.0-native-2` | 2026-09-01 |

The production group above is the rollback target. The hold document's
`39eb1e9b-8b72-480b-99f1-f52ad6d351fc` is stale and should be corrected.

`cert_probe_01` must remain intact and is not modified by this work. No
production server state is mutated.

## Non-blocking follow-ups

Tracked separately in `BACKLOG.md`; none of them gate this fix.
