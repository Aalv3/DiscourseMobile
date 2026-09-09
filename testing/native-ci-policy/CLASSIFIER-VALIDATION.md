# Surface classifier validation — 2026-09-09

Run of `scripts/ci-detox-surface.sh` against representative historical diffs on
the working trunk, required before merging the policy change.

```
--- expected TRUE: native / runtime / harness / logged-out shell ---
PR#2  pin runtime dependencies             true   files=2    native, runtime or logged-out-shell surface changed: package.json,yarn.lock
close dependency findings                  true   files=12   native, runtime or logged-out-shell surface changed: .github/workflows/ios-tests.yml,.github/workflows/jest-tests.yml,.github/workflows/linting.yml,js/site_manager.js,package.json
remove Ionicons native decl                true   files=2    native, runtime or logged-out-shell surface changed: ios/Discourse/Info.plist
iOS share extension host                   true   files=2    native, runtime or logged-out-shell surface changed: ios/ShareExtension/ShareViewController.swift
forward custom URLs to RN                  true   files=2    native, runtime or logged-out-shell surface changed: ios/Discourse/AppDelegate.swift
PR#17 CI detox hygiene                     true   files=3    native, runtime or logged-out-shell surface changed: .github/workflows/ios-tests.yml,e2e/jest.config.js,e2e/loggedOutLaunch.js
PR#16 notification routing                 true   files=3    native, runtime or logged-out-shell surface changed: js/Discourse.js
PR#19 authenticated WebView                true   files=7    native, runtime or logged-out-shell surface changed: js/Discourse.js
--- expected FALSE: authenticated-surface JS / docs only ---
PR#14 docs certification record            false  files=3    no native, runtime or logged-out-shell surface changed
ratelimit cooldown split                   false  files=6    no native, runtime or logged-out-shell surface changed
PR#11 private member-photo                 false  files=2    no native, runtime or logged-out-shell surface changed
onboarding policy + launch gates           false  files=8    no native, runtime or logged-out-shell surface changed
PR#7 native search queries                 false  files=4    no native, runtime or logged-out-shell surface changed
```

All 13 classifications are correct.

Native, runtime, CI-harness and logged-out-shell changes all select the full
suite. Authenticated-surface changes — rate limiting, private member photos,
onboarding, native search — and docs-only changes skip it, because the Detox
suite signs in to nothing and could not have observed them.

Two results are worth recording explicitly:

- `PR#2 pin runtime dependencies` was first tested with the commit pair
  inverted, so the merge-base diff was empty. The script returned
  `full=true, reason=changed-file list unavailable; failing closed to the full
  suite`. That is the fail-closed path behaving correctly on a degenerate
  input, and it is why the fallback exists.
- `onboarding policy + launch gates` classifies false. That is correct:
  `js/product/AdjusterCardOnboardingScreen.js` is post-authentication
  onboarding, which the logged-out suite cannot reach.

Scenario coverage beyond the historical diffs:

```
EVENT=schedule                   -> full=true   nightly full regression
EVENT=workflow_dispatch          -> full=true   manual full regression requested
LABELS=full-detox                -> full=true   owner label full-detox
LABELS=skip-full-detox           -> full=false  owner label skip-full-detox
BASE/HEAD unset                  -> full=true   failing closed to the full suite
```
