# Native push foundation and OTA compatibility — 2026-08-12

## A3-owned push boundary

Production delivery is dark by construction. `pushEducation` and `pushDelivery` are independently
default-OFF, the A3 backend origin is unset, the Android FCM adapter fails closed, and the iOS target
does not yet carry an APNs entitlement. No analytics dependency or upstream Discourse relay is used.

When credentials and the A3 service exist, the intended lifecycle is:

1. After authentication, the member may deliberately open the contextual notification education UI.
   The app never requests permission on first launch.
2. A denial is stored as a preference and does not request or register a transport token.
3. A grant creates a per-installation identity in device-only Keychain/Keystore storage and registers
   the APNs/FCM token with the A3 service.
4. Provider token rotation calls the authenticated refresh endpoint atomically.
5. Preference changes are synchronized with the A3 service.
6. Logout/account removal unregisters before the account token is removed, detaches the refresh
   listener and resets the local preference. Reinstall detection rotates an orphaned iOS Keychain
   installation identity rather than linking the new install to the old account.
7. Notification taps accept only authenticated `/t/*`, `/c/*` and `/u/*` relative paths. Full URLs,
   traversal, auth/session paths and unauthenticated taps fail closed. Payloads are never cached or
   logged by the foundation.

### Required A3 backend contract

All endpoints require the current member User API key and derive account identity server-side:

```text
PUT    /native/v1/push/registrations/{installation_id}
POST   /native/v1/push/registrations/{installation_id}/refresh
DELETE /native/v1/push/registrations/{installation_id}
GET    /native/v1/push/preferences
PUT    /native/v1/push/preferences
```

Registration/refresh accepts only `platform`, `environment`, `appId`, `appVersion`, `build` and
`transportToken`. The service must enforce staging/production separation, encrypt tokens at rest,
honor preferences before enqueueing, remove invalid/stale tokens, provide global/environment/class
kill switches, and log only redacted delivery metadata. Lock-screen payloads must contain an approved
generic summary plus an opaque notification ID and allowlisted relative path—never member content,
topic title, username, claim data, auth data or a full URL.

Mock certification covers default-off behavior, denied permission, grant/registration, minimum
metadata, secure installation identity, reinstall rotation, token refresh, preference sync,
logout/unregister and privacy-safe routing. Live APNs/FCM certification remains blocked by the A3
service and credentials.

## Expo Updates compatibility spike

The spike was isolated in a detached disposable worktree at baseline `9ece6bfb`. Immutable Yarn
installation succeeded. The official `install-expo-modules@0.16.0` installer then stopped before
native modification with:

```text
Unable to find compatible Expo SDK version - reactNativeVersion[0.80.2]
```

This is a material compatibility boundary for the current React Native 0.80.2/New
Architecture/Hermes application. No unsupported Expo SDK was forced, no canonical dependency or
lockfile was changed, and Debug/Release/startup/offline/update recovery could not be responsibly
certified. EAS Update is therefore **not approved for integration on the current native baseline**.

### OTA recommendation

Keep OTA unimplemented for the founding binary. Re-evaluate `expo-updates` after a separately scoped
React Native upgrade lands on a version supported by a current Expo SDK. At that point, repeat the
isolated spike and require Debug/unsigned Release builds, authenticated startup, embedded offline
baseline, runtime incompatibility rejection, signed artifact verification, tamper rejection,
staging-to-production exact-artifact promotion, staged rollout, failed-launch recovery, explicit
rollback, kill switch and reinstall-to-embedded-baseline certification.

Do not create a bespoke JS bundle loader merely to avoid the compatibility boundary. An A3-hosted
Expo Updates Protocol service remains a later alternative only after the same supported client
integration exists; self-hosting does not solve the incompatible native client and adds rollout,
availability and incident-response burden.

Permanent policy remains: OTA may deliver reviewed JS/assets only. Any native dependency,
capability, permission, entitlement, runtime ABI or JS/native contract change requires a new signed
store build. The embedded store bundle is always the offline recovery baseline.
