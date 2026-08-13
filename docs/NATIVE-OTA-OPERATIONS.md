# Native OTA operations

Adjuster Network uses EAS Update through `expo-updates` for JavaScript and
bundled assets only. The native iOS and Android projects remain hand-managed.

## Build 1 security model

Build 1 uses standard EAS Update transport on the existing Starter account.
EAS project isolation, HTTPS delivery, artifact hashes, the explicit native
runtime boundary, staging and production channels, anti-bricking, and the
embedded recovery bundle remain mandatory. End-to-end publisher code signing
is explicitly deferred; release evidence must not claim cryptographic update
signing until that capability is configured and certified.

## Immutable boundaries

- Runtime `an-ios-android-1.0.0-native-1` is a hard compatibility boundary.
- Any native source, native dependency, entitlement, permission, capability,
  Expo module, or native configuration change requires a new store binary and
  a new runtime value.
- The embedded bundle remains enabled. Launch waits zero milliseconds for the
  network; a downloaded update becomes eligible on a later launch.
- Expo anti-bricking measures must remain enabled.
- Build 1 does not embed a publisher signing certificate.

Run `yarn verify:ota` before every native build or update publication.

## Release evidence and promotion

Set `AN_OTA_GIT_SHA` to the exact clean source commit for both EAS Build and
EAS Update. A production publish must begin with the exact signed update that
passed on staging; promote/republish that update group rather than rebuilding
it. Record Git SHA, runtime, update group and update IDs, artifact hashes,
channel, signer key ID, rollout percentage, and the verification result.

1. Publish an update to `staging` under the owner-controlled EAS project.
2. Certify the update on a staging-channel binary, including offline relaunch,
   auth/Keychain, member screens, privacy, accessibility, and readiness.
3. Republish the certified update group to `production`; do not rebundle it.
4. Start production at a bounded rollout percentage and increase only after
   reviewing readiness and crash/support signals.

The update must contain no credentials or private member payloads. Never print
the private key, auth tokens, or notification payloads in release evidence.

## Recovery and kill switch

- Pause a rollout or revert it to the control update for an immediate rollout
  kill switch.
- Roll back the channel to the prior known-good update group when that group is
  healthy for the same runtime.
- Use EAS rollback-to-embedded when no remote update is trustworthy.
- A failed launch is handled by expo-updates error recovery and anti-bricking;
  the embedded update is the final offline recovery baseline.
- Losing or rotating the signing key requires a new certificate, runtime value,
  and store binary. An old binary must never accept updates from a new signer.

Update publication is prohibited until the Production/Enterprise EAS plan is
confirmed, the private key is stored in the owner secret manager, and the full
staging certification matrix has passed.
