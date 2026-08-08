# Adjuster Network native foundation handoff

## Baseline and branch policy

- Canonical working repository: this `Aalv3/DiscourseMobile` fork.
- Baseline `e8bf7472` is byte-for-byte aligned with `discourse/DiscourseMobile` `main` as of 2026-08-08.
- Product work belongs on `codex/an-2700-native-foundation` (and later short-lived `an-27xx/*` branches); periodically fetch `upstream`, rebase product branches, then validate the backend contract before integration.
- Never commit signing material, provisioning profiles, Firebase credentials, or store credentials.

## Reproducible gates

```text
corepack yarn install --immutable
corepack yarn prettier
corepack yarn eslint
corepack yarn test:unit --runInBand
corepack yarn verify:backend
```

Android compilation additionally requires a supported JDK/Android SDK. iOS compilation and Detox require macOS, Xcode, CocoaPods, and an available simulator. Store publication is explicitly out of scope.

## Deployed ESR compatibility (2026-08-08)

The provider-independent harness checks the production-safe anonymous contract only. It requires `/user-api-key/new` to advertise mobile API v2 or newer, `/site/basic-info.json` to report a closed site, anonymous `/site.json` to remain forbidden, and the web manifest to remain available. It never creates an account or invitation and carries no credentials.

Authentication remains upstream Discourse User API Key authorization: system browser, RSA challenge, `discourse://auth_redirect`, then encrypted token persistence in AsyncStorage. A release build must replace the shared upstream URL scheme with a separately registered application scheme and test approval, cancellation, replay/state mismatch, revocation, logout, and reinstall.

Deep links currently support upstream `discourse://open` notification/site routing. Universal/App Links for `adjusternetwork.org`, association files, and cold/warm-start tests are release gates, not assumed complete.

Light/dark mode follows the OS through `ThemeContext`; legacy Android has a stored override. Both modes require screenshot/accessibility validation after final assets and colors exist.

## Reversible branding/navigation slice

`js/adjusterNetworkConfig.js` is the single product boundary. The app display name is Adjuster Network and existing proven tabs are relabeled `Floor` and `Activity`. The intended `Ask`, `CAT`, and `You` destinations are explicitly unavailable: no placeholder screen or fabricated backend capability is exposed. Native bundle IDs, app target names, icons, signing, push, and upstream multi-site mechanics are deliberately unchanged.

The current mappings are:

| Product destination | Current route | Status |
| --- | --- | --- |
| Floor | Home | available |
| Activity | Notifications | available |
| Ask | none | blocked on stable compose contract |
| CAT | none | blocked on intelligence/backend contract |
| You | none | blocked on first-party profile/onboarding contract |

## Restriction compatibility

The app must preserve server authority: invite-only registration, disabled uploads/images, disabled member DMs, staff permissions, export authorization, and AN-037 closure cannot be overridden by client UI. The anonymous harness positively checks the closed-site boundary. Authenticated restriction tests need a newly authorized synthetic fixture wave; they were not inferred from source and no production identity was created here.

## Upgrade and release gates

1. Add Android CI compilation on a pinned supported JDK/SDK and iOS build/Detox on macOS.
2. Allocate owned bundle/application IDs, URL scheme, associated domains, Firebase project, and signing through an owner-approved release lane.
3. Run authenticated ESR tests for token lifecycle, restricted compose/upload/PM behavior, moderation separation, and deep links.
4. Supply final owned vector/raster assets and validate light/dark, dynamic type, screen readers, and small screens.
5. Only implement Ask/CAT/You once their backend contracts are stable; keep adapters at this configuration/navigation boundary.
6. Rebase onto upstream regularly and run immutable install, formatting, lint, unit tests, native builds, Detox, and the backend harness before each release candidate.
