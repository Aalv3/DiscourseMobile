# Native CI policy

## What the Detox suite actually covers

**The Detox suite exercises the logged-out shell only.** It is three specs, and
every assertion in it resolves to one of two screens:

| Assertion | Owning source file |
| --- | --- |
| `logged-out-welcome-scroll` | `js/product/ProductScreens.js` |
| "Members only", "Member sign in", "Signing in…", "Invitation-only membership" | `js/product/ProductScreens.js` |
| `nav-plus-icon` | `js/screens/HomeScreenComponents/NavigationBar.js` |

It signs in to nothing. It therefore provides **no coverage** of notifications,
notification routing, the OTP session bootstrap, the authenticated WebView,
member profiles, avatars, private member photos, rate limiting, chat, or
anything else behind authentication. Those surfaces are covered by Jest, by the
static native gates, and by physical-device certification.

Do not cite a green Detox run as evidence that an authenticated surface works.
It cannot be.

## Which checks run on which change

Every pull request runs the fast gates:

- ESLint and Prettier
- Jest
- `verify:ota`, `verify:ios-auth`, `verify:release-readiness`,
  `verify:backend`, `validate:ota`

The full iPhone + iPad Detox regression is roughly 100 minutes of macOS runner
time per iteration. It runs only when the change can affect something the suite
can actually observe:

- `ios/`, `android/`
- `e2e/`, `.detoxrc*`
- `.github/workflows/`
- `package.json`, `yarn.lock`, `app.json`, `eas.json`, `Gemfile*`, and the
  `*.config.*` roots
- `js/product/ProductScreens.js`, `js/screens/HomeScreen*`,
  `js/Discourse.js`, `js/iosAuthSession.js`, `js/site_manager.js`
- the `full-detox` label, `workflow_dispatch`, or the nightly schedule
- any case where the changed-file list cannot be computed — this **fails
  closed** to the full suite

`scripts/ci-detox-surface.sh` makes the decision and writes its reasoning to the
job summary, so every run states why Detox ran or was skipped.

## Overrides

`full-detox` forces the suite on. `skip-full-detox` forces it off and is an
explicit owner override, not a routine way around classification: use it only
when the classification is demonstrably wrong for a specific change, and say why
in the pull request.

A pull request stacked on an unmerged branch inherits its parent's changed files
and will usually run the full suite. That is the conservative outcome and is
left as-is; the durable fix is landing the lineage rather than loosening the
rule.

## What was deliberately not changed

Detox assertions, matchers, the 180s hook budget, `--retries 2`, and the
failure-artifact upload are untouched. A failing test still fails the job, and
failures remain fully visible. This policy changes *when* the suite runs, never
what it asserts or how loudly it fails.
