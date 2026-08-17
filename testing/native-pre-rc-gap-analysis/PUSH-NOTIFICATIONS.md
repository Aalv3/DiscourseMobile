# Push notifications

## Classification

**SOURCE REMEDIATION REQUIRED**, followed by production TestFlight device recertification.

## What Build 2/current committed source already has

- Trusted build pairing: Debug development/staging; App Store production/production.
- `aps-environment=$(AN_APNS_ENVIRONMENT)`, runtime `ANPushEnvironment`, topic `org.adjusternetwork.app`.
- APNs token, User API client ID, and installation identity are separate.
- Duplicate `enable()` calls coalesce; repeated identical registration is skipped in-process.
- Backend 429 sets a bounded 60-second cooldown and becomes `push_temporarily_unavailable`.
- Registration uses User API Key/client ID plus a bounded nonce; URL is HTTPS and Adjuster Network-host restricted.
- Tap payload allowlisting/routes and foreground observation are automated.

## First unresolved source divergence

`Discourse.componentDidMount()` calls `status()`, then revalidates an enabled preference. Both rejection branches set only `push_registration_failed`. This discards `push_token_failed`, `push_installation_failed`, `push_backend_rejected_<status>`, nonce failure, and temporary network/rate-limit state. The manual enable handler also allowlists only generic backend strings, so status-specific rejection and nonce errors collapse again. The UI cannot truthfully distinguish recovery action or prove the production failure stage.

## Required remediation/tests

1. One sanitizer maps internal errors into privacy-safe categories: permission, APNs token, installation identity, nonce, backend status class, temporary network/rate-limit, configuration.
2. Use it in startup revalidation, manual enable, token refresh and registration failure paths.
3. Preserve `DEVELOPMENT_BUILD_LIMITATION` behavior; never attempt production registration with a development entitlement.
4. Test startup enabled preference for token/install/nonce/403/404/409/429/5xx/transport; assert no token/client/installation values enter UI or logs.
5. Decide bounded retry trigger after 429; do not loop on each render/background refresh.

## Exact physical TestFlight proof

- Install exact next build over Build 2 and as a clean install.
- Record only booleans/environment: authorization, production APNs token present, installation ID present, backend registration 2xx, environment production, topic correct, owner account correct.
- Deny permission and verify disabled/recovery; then Settings-enable and revalidate.
- Foreground receipt, background receipt, terminated-app tap to canonical native route.
- Token refresh/re-registration and force-quit/relaunch are idempotent; no 429 loop.
- Logout/login does not cross accounts; reinstall creates the intended installation identity.
