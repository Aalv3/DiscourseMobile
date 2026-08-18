# iOS Mac/Xcode release-readiness wave

## Boundary

This wave is simulator-first and produces evidence without signing, archiving, uploading, store
submission, domain mutation, production account creation, or legal/privacy assertions. Run it only
from the canonical native branch after the owner supplies a Mac with current Xcode. Keep all logs,
screenshots and UI trees under ignored `.local/evidence/ios-release-readiness/<run-id>`; redact tokens, email addresses,
private content and callback payloads before sharing any evidence.

## Build storage and retention

Native build state and durable evidence are deliberately separated:

- `.local/build-workspace/<workflow>/<run-id>` is disposable. The readiness script removes its
  DerivedData on success, failure, interruption and termination.
- `.local/evidence/<workflow>/<run-id>` contains only revision data, readiness JSON, concise logs,
  manifests and accounting. Ordinary evidence keeps the newest three runs and expires after ten
  days.
- A `.protected` marker exempts an explicitly approved evidence run from ordinary retention.
  Signed `.xcarchive`, `.ipa` and archive `.dSYM` artifacts are never cleanup candidates and belong
  in the approved release-artifact location, not the build workspace.

The preflight warns below 50 GiB free and refuses a full native build below 25 GiB. An emergency
operator may set `AN_NATIVE_EMERGENCY_DISK_OVERRIDE=1`, but must record why. Set
`AN_RETAIN_NATIVE_BUILD_STATE=1` only for an intentional diagnostic investigation; normal runs
never retain DerivedData. Active-run locks prevent maintenance from touching an in-progress build
and stale locks are recovered only after the owning process is gone and a 15-minute race-safety
grace period has elapsed.

Inspect usage and reclaimable state safely (dry-run is the default):

```bash
corepack yarn native:storage
```

After reviewing the exact candidates, delete only managed disposable/expired state with:

```bash
corepack yarn native:storage:delete
```

Each completed workflow reports free disk before/after, workspace size, retained evidence size and
whether diagnostic state was intentionally retained. To recover after cleanup, rerun
`corepack yarn install --immutable`, `bundle install`, and
`bundle exec pod install --project-directory=ios`; the next native build regenerates DerivedData.

## Automated build wave

```bash
git fetch --all --prune
git status --short --branch
git merge-base --is-ancestor upstream/main HEAD
bash scripts/ios-release-readiness-wave.sh
```

Record the exact commit, macOS, Xcode, simulator runtime, Ruby, CocoaPods, Node and Yarn versions.
The script performs an immutable install, Pods install, formatting, lint, unit tests, the static
release audit and a no-signing Release simulator build. It deliberately cannot claim runtime GO.

## Required runtime matrix

Use a synthetic owner-authorized test identity only, then dispose it with the established AN-037
workflow. Exercise iPhone 16 Pro and iPad (10th generation), plus the oldest supported iOS runtime
available in the approved Xcode toolchain:

1. Fresh install starts signed out and exposes no private content.
2. Safari authorization returns through the exact callback; cancellation, malformed payload,
   state mismatch and replay all fail closed.
3. The iOS one-time-password continuation establishes the private WebView session without exposing
   the OTP in logs or navigation history.
4. Keychain persistence survives force-quit/relaunch; server revocation removes local access;
   account removal clears Keychain, cookies and metadata; uninstall/reinstall is truthfully signed
   out; account A data never appears for account B.
5. Cold/warm custom-scheme links pass. Universal Links remain a recorded owner-input blocker until
   the approved bundle ID, associated domain entitlement and AASA file are all in place.
6. HTTP, cleartext, external, malformed, file, data, JavaScript and prefix-confusable URLs fail
   closed or leave via the system browser as designed. Confirm ATS logs contain no exception.
7. Background/app-switcher snapshots show the privacy shield, then restore safely.
8. VoiceOver names Connect, Floor, Activity, site/account, Settings and removal controls in logical
   order. Test default and largest accessibility Dynamic Type, portrait/landscape, light/dark, and
   keyboard/safe-area behavior without clipped primary actions.
9. Search runtime logs for tokens, callback payloads, OTPs, email addresses, private URLs/content,
   advertising identifiers, analytics and crash-provider traffic; all must be absent.

For each row record PASS/FAIL/BLOCKED, device/runtime, elapsed time, screenshot/log artifact name and
cleanup result. A failure blocks iOS release readiness. Missing owner identity/domain/signing inputs
are `BLOCKED—OWNER`, not inferred or substituted with upstream identities.

## Owner-controlled configuration packet

Before a signed non-store archive can be prepared, obtain one explicit packet: Android application
ID, iOS app and Share Extension bundle IDs, unique callback scheme, Apple team/certificate custody,
Android keystore custody, approved Universal/App Link domains, association-file authorization,
Firebase decision/configuration, version/build numbering, store listing owner, and approved privacy
answers. Secrets stay out of Git. Store upload/submission remains a separate authorization.

The Mac itself is an external execution prerequisite, not an owner product choice. Minimum access is
an interactive shell and Xcode Simulator session on a Mac that can check out the canonical branch,
install the locked dependencies, reach the synthetic test environment when separately authorized,
and return redacted evidence artifacts. The unsigned simulator wave can run before Apple signing or
store access is supplied.
