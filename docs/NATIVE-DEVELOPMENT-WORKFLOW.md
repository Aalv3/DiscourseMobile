# Adjuster Network native development workflow

This is the canonical workflow. Ceremony follows the affected boundary, not the
size of the diff. Start with `yarn native:lane`, then use exactly one lane.

## Lanes

### JS/UI fast lane

Use only when the diff changes JavaScript, copy, layout, or bundled assets and
does not alter a native module, native dependency, permission, entitlement,
runtime, auth, push, deep-link, Keychain, signing, or security boundary.

1. `yarn validate:js-ui`
2. Simulator visual check at required widths and accessibility settings.
3. From an exact clean commit: `yarn ota:stage --message="..."`.
4. Launch the permanent staging app twice, then use
   `yarn device:harness ota-status` and physically certify the change.
5. With founder approval, promote the exact group without rebundling:
   `yarn ota:promote --group=<certified-group> --message="..."`.

An ordinary spacing correction, including the Ask-label clearance fix, ends
here. It does not consume a TestFlight build.

### Native lane

Use for Objective-C/Swift/Kotlin, Pods, native dependencies, app configuration,
permissions, entitlements, Expo modules, or JS/native bridge changes.

1. Audit the complete affected native boundary.
2. `yarn validate:native` (includes a real generic `iphoneos` Release compile).
3. Install a signed internal staging build with
   `yarn device:harness install --app=<signed-app>`.
4. Run the bounded physical smoke and retrieve durable evidence.
5. Use TestFlight only for production signing/APNs/App Store behavior or an
   upgrade path that an internal build cannot certify.

Simulator-only evidence never certifies native behavior.

### System/security lane

Push, auth, permissions, deep links, Keychain, signing, and security changes
must be audited end-to-end before implementation. List every callback, promise,
event race, timeout, entitlement, backend boundary, foreground/background path,
and physical-only assumption. Add privacy-safe deterministic diagnostics first.
Then run `yarn validate:system`, a signed physical staging smoke, and an exact
TestFlight artifact when production distribution behavior matters.

Do not spend sequential TestFlight builds discovering boundaries that source
review and never-settling tests can expose together.

## Permanent staging app

The internal staging profile is permanently bound to channel `staging` and
runtime `an-ios-android-1.0.0-native-2`. It is remote-update-first:
`EXUpdatesHasEmbeddedUpdate=false`. A newly compiled embedded bundle therefore
cannot outrank an older but approved staging update. Production remains
`EXUpdatesHasEmbeddedUpdate=true` for its offline recovery bundle. Both retain
anti-bricking protection and the same runtime while their native API surface is
compatible.

Rebuild the staging app only when the native runtime changes, the staging
profile expires, or the staging app itself has a proven native defect—not for
ordinary JavaScript changes.

## OTA provenance

The staging publication is the one and only JS export. Record source SHA,
runtime, group ID, platform update IDs, bundle hashes, and publication time.
Physical certification records the active update ID using the device harness.
Production uses EAS `update:republish --group`; it never rebuilds the bundle.
If the exact group cannot be identified or the source tree is dirty, stop.

## Physical-device harness

`yarn device:harness status` selects a paired physical iPhone without printing
its UDID. `install`, `launch`, and `ota-status` use `devicectl` JSON interfaces
and keep private device metadata under mode-0700 `.local/evidence`.
`push-diagnostics` extracts only timestamp, stage, category, HTTP class, and
outcome from the app's bounded 64-KiB protected diagnostic file. Tokens,
installation IDs, nonces, credentials, payloads, and unrelated device logs are
never written by this channel. Founder-observed visual checks and screenshots
remain part of evidence when Apple provides no supported CLI screenshot API.

## Risk matrix

| Change | Unit/lint | Simulator | Physical iPhone | Staging OTA | Native staging build | TestFlight |
|---|---:|---:|---:|---:|---:|---:|
| JS logic/copy | required | as affected | only device-specific UX | required before production OTA | no | no |
| Layout/visual | required | required widths/a11y | required for release-significant UI | required | no | no |
| Native API/dependency | required | useful, insufficient | required | only for later JS | required | when distribution behavior matters |
| Push/auth/permission/deep link/Keychain | required + boundary tests | useful, insufficient | required | not certification | required | required for production-only behavior |
| Signing/entitlements/App Store packaging | release checks | no | after distribution build | no | optional diagnostic | required |
| Documentation/tooling only | focused tests | no | no | no | no | no |

## Canonical commands

- `yarn native:lane` — classify the current delta.
- `yarn validate:js-ui` — format, lint, Jest, OTA boundary.
- `yarn validate:ota` — JS/UI validation plus OTA readiness.
- `yarn validate:native` — complete validation plus real `iphoneos` compile.
- `yarn validate:system` — native validation and an explicit physical gate.
- `yarn verify:release-readiness --archive <path>` — exact TestFlight archive.
- `yarn native:storage` — dry-run build/evidence accounting.

All native builds use the managed disposable workspace, disk guardrails, active
run lock, concise evidence, and automatic cleanup documented in
`IOS-MAC-RELEASE-READINESS-WAVE.md`.

## Gates removed and retained

Removed: TestFlight for JS/layout; a new staging build per OTA; rebundling after
staging; repeated manual provenance checks; full DerivedData as evidence;
Console.app source selection; and micro-approval stops where a deterministic
command can safely continue.

Retained: clean immutable SHA, automated validation, simulator visual evidence
for UI, exact staging-group physical certification, real `iphoneos` compilation
for native changes, archive signing/entitlement assertions, physical system
certification, and founder authority for production/TestFlight actions.

## Builds 2–7 and Ask OTA lessons

| Incident | Why it escaped | Permanent prevention |
|---|---|---|
| Build 2 push registration failed with generic copy | errors collapsed across stages | bounded result contract and system-lane boundary audit |
| Build 3 retry did not expose the terminal cause | state propagation and physical diagnostics were incomplete | mounted retry tests plus durable bounded diagnostics |
| Build 4 `requestPermissions` hung with permission already granted | wrapper behavior assumed from simulator/tests | native authorization-state path and never-settling tests |
| Build 5 `checkPermissions` hung | another wrapper boundary was audited serially | native `UNUserNotificationCenter` bridge and whole-path audit |
| Build 6 gate rejected a production TestFlight app before registration | runtime parsed `embedded.mobileprovision` text | runtime trusts bounded environment; archive verifies signed entitlement |
| First Build 7 archive used unsupported `SecTask` declarations | simulator/source checks did not compile the real device SDK soon enough | mandatory generic `iphoneos` compilation before archive |
| Corrected Build 7 delegated entitlement authority correctly | release-time and runtime responsibilities were duplicated | archive gate owns signing; iOS callbacks own runtime truth |
| Ask-label OTA became staging-build work | no permanent remote-first staging app; newer embedded update outranked OTA | staging suppresses embedded update and exact-group device inspection |
| Physical logs were repeatedly inconclusive | Console.app filtering/source was fragile | protected bounded app diagnostic file retrieved by CLI harness |

## Binding Codex operating rules

Audit the whole affected boundary before serial fixes. Never claim native
correctness from Simulator alone. Never invent release infrastructure during a
product fix. Never consume TestFlight builds for source-level uncertainty.
Browser behavior requires a browser, not a crawler. Secret-bearing files must
not be printed or committed. Continue through deterministic safe steps and stop
only for genuine founder authority, external credentials, destructive action,
or a material product decision.
