# Native rate-limit resilience — production certification

Recorded: 2026-09-08 (America/New_York)
Verdict: **PRODUCTION OTA CERTIFIED**

## Shipped artifact

| Field                | Value                                                                                                    |
| -------------------- | -------------------------------------------------------------------------------------------------------- |
| Certified SHA        | `dad0af191716aca8d33c6afe58900e70d2be29e4`                                                               |
| Tag                  | `ota-a4a5e4ee-dad0af19`                                                                                  |
| Production OTA group | `a4a5e4ee-f11d-4804-9756-50c0ede8cd54`                                                                   |
| iOS update           | `01a08212-1e11-7fec-83a3-9c20b9d80de1`                                                                   |
| Android update       | `01a08212-1e11-73a9-af10-65ad49debf68`                                                                   |
| Runtime              | `an-ios-android-1.0.0-native-2`                                                                          |
| Rollback target      | group `a81e298f-1e6f-4b5f-8c7c-ea466833e57b`, iOS `01a078d2-f294-701b-950b-af3ac6864835`, SHA `f662cf3b` |

Rollback command: `yarn ota:promote --group=a81e298f-1e6f-4b5f-8c7c-ea466833e57b`

This was a **direct production publish**, not a staging republish, because staging
was deliberately left untouched. Its manifest therefore carries
`expo-channel-name: production` and `useEmbeddedUpdate: true`, unlike earlier
promotions that were republished from staging.

## Defects corrected

**Retry-After was silently discarded.** `RequestOrchestrator.beginCooldown`
called `retryAfterDelayMs(response, retryIndex)`, but that helper takes the
Retry-After header _value_, so it returned `null` on its first type check. The
cooldown was then set to `now() + null`, which is `now()`, and expired
instantly. Retry-After was never honored and the limiter never blocked anything.
The production ledger corroborated it exactly: every recorded `cooldown_begin`
carried `durationClass: "short"`, which is what `null < 10000` evaluates to.

**One ceiling was doing two jobs.** Clamping the cooldown to the per-request
ceiling meant a production `Retry-After: 136` was recorded as 60s, so GET chains
re-entered a known-active window at roughly 60s and 120s. The two concerns are
now separate: `RATE_LIMIT_COOLDOWN_MAX_MS` (180s) bounds the server-directed
cooldown lifetime; `RATE_LIMIT_MAX_MS` (60s) bounds how long one request may
block. When the remaining cooldown exceeds the per-request ceiling,
`waitForBucket` fails fast with the existing bounded `api_rate_limited` error
rather than sending a request into an active window, and leaves the cooldown
intact so later requests keep observing it.

**Avatars latched the letter initial permanently.** `onError` set `failedUri`,
and the reset only ran when the URI changed — which never happens for a fixed
member and size. Stack screens remount on every navigation and the member-photo
route sends `Cache-Control: private, no-store`, so each mount issued a fresh
authenticated request and a single 429 was terminal for that instance. Recovery
is now bounded: two delayed retries (1.5s, 6s) counted per URI, then the initial
stands. The pending timer is cleared on unmount.

**Duplicate profile reads.** `/u/:username.json` had no TTL, so remounting
refetched it every navigation. It now coalesces inside a 15s TTL without serving
stale. Chat message loads are deliberately excluded because they are real-time.

## Corrections to earlier analysis

Two of our working hypotheses were wrong and are recorded so they are not
repeated:

- **Message-bus does not carry `User-Api-Key` and does not consume the User API
  bucket.** The earlier attribution of ~65% of bucket consumption to
  message-bus was incorrect. Native has no message-bus client at all; the
  hypothesis that the `WKWebView` Discourse session was consuming the User API
  bucket is also disproved.
- **Real pre-change User API pressure** came primarily from `/chat/api/*`,
  member-photo image loads, `/u/*.json`, and `/native/v1/*`.

## Physical device certification

Founder-led on the production iPhone, with the server lane observing read-only.

Floor, Discussions, Ask, Lounge, Intel, You, Member Profile, Edit Profile,
back-navigation and remounts, Notifications, background/foreground,
force-close/reopen, and post-reopen You → Member Profile → Edit Profile: all
PASS. Avatar rendered as a photo on every profile surface including across
remounts. No crashes or hangs.

Server observation over ~6 minutes: 94 device requests, 92 bucket-consuming,
peak rolling 10s = 9, peak rolling 60s = 21. **User API 429s = 0**, other 429s =
0, 5xx = 0. member-photo 16/16 200, `/u/*.json` 5/5 200, `/native/v1/*` 19/19
200, `/chat/api/*` 14/14 200, `/site.json` 8/8 200, `/latest.json` 8/8 200. No
server-side contradiction to the founder results.

### Scope limit of this certification

**No natural 429 occurred during the run.** Retry-After handling, the fail-fast
path above the per-request ceiling, and avatar recovery from a transient failure
therefore remain **code- and CI-validated, not production-trigger validated**.
The run proves the change is healthy under normal load and did not regress
anything; it does not prove the limiter behaviour under a live 429.

## Validation

CI green 4/4 on the exact SHA: lint, Jest, iPhone Detox (54m5s), iPad Detox
(54m21s). Locally: 94 suites / 719 tests, `verify:ota` 17/17,
`verify:ios-auth` 12/12, native Release BUILD SUCCEEDED.

Preserved throughout: private member-photo credential boundary (only
`/renaissance/member-photo/` receives User API credentials), ordinary
`/user_avatar/` unauthenticated, canonical-origin guard, secure-media origin
guard, identity refresh, logout and account-switch cleanup. No server settings,
runtime, or binary change. The 100/min server setting is not to be reopened.

## Avatar-resolution diagnostic (superseded, not merged)

Branch `diag/native-avatar-resolution-20260908`, draft PR #12, final SHA
`a4b82b6ddf34183c00b57cbf62ba2417c2735f94`. Never merged and never promoted to
production; retained on the branch for reuse.

It instrumented the shared `Avatar` with a monotonic per-instance id, a UTC
timestamp with milliseconds, mount/unmount, the React key, source-object
recreation, the navigator kind, the resolved path, the authority key and
presence, the `memberImageSource` classification, whether `failedUri` matched
the resolved URI, the fallback branch taken, and the image lifecycle with the
exact `nativeEvent.error`. Instance ids mattered because `no-store` plus stack
remounting means several Image instances share one URI and their events
interleave.

It was never run: the fixture iPhone was on the production channel and could not
consume a staging OTA, and no second device was available. The root cause was
instead proven from source plus the server lane's 429 evidence, so the design is
recorded here rather than carried in trunk. The two ideas worth keeping are the
per-instance id for correlating interleaved events, and a UTC wall clock with
milliseconds for aligning a specific client instance against an edge log.
