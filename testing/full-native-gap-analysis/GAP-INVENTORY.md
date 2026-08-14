# Adjuster Network iOS/native gap inventory

## Baseline and evidence rules

- Canonical native SHA: `7c9a25a49d3997e65d45c27784592ceef2d5e8ae`
- Branch: `codex/notification-tap-routing`; origin exact match at audit start.
- Simulator: iPhone 17 Pro, iOS 26.5, `E281C0FD-BC09-46DB-B0C3-FF55F6EED966`.
- Discovery changed no product source. Existing untracked build/evidence directories were preserved.
- A state is **runtime** only when observed on the current installed build. **Automated** means a
  current test exercised the policy or transition. **Structural** means the current render and event
  path were traced but not invoked with production member data. Prior physical certifications are
  treated as corroboration, not a substitute for current runtime evidence.

## Totals

- Meaningful screens/states inventoried and audited: **82**.
- Controls/actions evaluated: **96** (current runtime, current automated tests, and bounded source
  traces; the matrix identifies the evidence level).
- Current automated baseline: **34 suites / 193 tests passing**, ESLint passing.
- Current canonical Release Simulator build completed once and supplied three signed-out captures.
- Findings: **4 P0**, **14 P1**, **8 P2/OTA-safe**, and **15 visual gaps**.
- Native binary findings: **2 NATIVE-P0**, **3 NATIVE-P1**.

## P0

| ID | Class | Finding | Evidence / impact |
|---|---|---|---|
| GAP-P0-01 | NATIVE-P0 | App Store push boundary still targets APNs sandbox/staging. | `Discourse.entitlements` says `aps-environment=development`; `adjusterNetworkConfig.js` says push environment `staging`. A production binary cannot deliver through the certified production APNs channel until this is separated at build configuration. |
| GAP-P0-02 | NATIVE-P0 | Share Extension uses the extension-hostile `UIApplication.shared` KVC/open technique, advertises up to 10 images, but processes only URL/text and silently closes. | `ShareViewController.swift` and extension activation rule. This risks broken sharing and App Review rejection; image invocations have no completion/error UX. |
| GAP-P0-03 | P0 / OTA-SAFE | Guardian-authorized Edit is absent for own topic-opening posts and replies. | `NativeTopicScreen` exposes Reply and `post.can_delete`, but never reads `can_edit` or performs the supported post update. Own-content management is incomplete. |
| GAP-P0-04 | SHARED/BACKEND | Owner-required Adjuster Card onboarding is not backed by one enabled canonical profile contract. | Native onboarding remains local orientation/interests. Backend has disabled structured fields, no headline contract, no scoped photo upload, and no private resume contract. The prior rich-profile audit correctly remains backend-blocked. |

## P1

| ID | Class | Finding |
|---|---|---|
| GAP-P1-01 | NATIVE-P1 | Matching `hermes.framework` dSYM is missing from the release-symbol set. |
| GAP-P1-02 | NATIVE-P1 | Launch screen still displays the stock gray Discourse speech-bubble asset rather than Adjuster Network identity. |
| GAP-P1-03 | NATIVE-P1 | Privacy manifests declare no collected-data categories despite authenticated identity/content, device push registration, and operational request data; two app-level manifests also exist with divergent reason sets. Reconcile against App Privacy answers before archive. |
| GAP-P1-04 | OTA-SAFE | Notification filtering marks deleted-topic notifications read but does not refresh/decrement the in-memory unread total, so bell/app badge can remain inconsistent until a later totals refresh. |
| GAP-P1-05 | OTA-SAFE | Recent contribution rows on Member Profile look like destinations but have no press action. |
| GAP-P1-06 | OTA-SAFE | Profile uses a generated initial instead of the canonical member avatar even when an avatar template is available. |
| GAP-P1-07 | OTA-SAFE | Discussions category pills only filter the latest page and expose at most five categories; they are not category-detail navigation and can imply an incomplete category view. |
| GAP-P1-08 | OTA-SAFE | Floor intelligence hero/weather/knowledge areas are static placeholders rather than the authenticated collection data already used by Intelligence. |
| GAP-P1-09 | OTA-SAFE | Intelligence has three valid native routes, but all can resolve to nearly identical empty tag collections; it is functional yet presently weak as a return destination. |
| GAP-P1-10 | OTA-SAFE | Search promises “discussions and members” but renders topic results only. |
| GAP-P1-11 | OTA-SAFE | Account deletion is passive explanatory text with no support/contact action. |
| GAP-P1-12 | OTA-SAFE | Native notification settings expose one email level and device enablement only; meaningful web controls are absent. |
| GAP-P1-13 | OTA-SAFE | Native topic UI can open bookmarks but has no create/remove bookmark action, leaving an important saved-content workflow read-only. |
| GAP-P1-14 | OTA-SAFE / VISUAL | At accessibility-extra-large text, the signed-out welcome becomes an extremely tall headline and pushes primary actions far below the initial viewport. The current canonical screenshot shows severe loss of scanability and requires bounded responsive typography/layout. |

## P2 / OTA-safe

1. Lounge uses bounded 10-second polling rather than Discourse MessageBus realtime.
2. Lounge omits supported reactions and message reply/thread affordances.
3. Topic MVP omits Like and jump/share conveniences beyond reply-parent jumps.
4. Offline behavior is truthful but contains no bounded last-known read-only cache.
5. Search has no recent queries, suggestions, member result section, or pagination.
6. Collection screens have no pull-to-refresh or pagination affordance.
7. Settings does not expose native account export; privacy copy must route members to support.
8. Six fixed bottom-tab labels disable font scaling; VoiceOver remains labeled, but very large-text
   users receive no alternate navigation presentation.

## Certified lanes not reopened

No new source divergence was found in User API client binding, auth/APNs/installation identity
separation, callback settlement, Keychain token storage, persistent onboarding state transitions,
native `/t`, `/c`, `/u` routing, Universal Links allowlisting, topic creator deletion, or the Lounge
keyboard model. These remain certified at their recorded scope. The production push *build channel*
finding is a distinct release-boundary issue, not a reopening of registration/delivery architecture.

## Untested or partially tested

- Current authenticated Simulator breadth: unavailable because no approved disposable credential or
  secure bootstrap was present; prior system-auth unreliability was not re-debugged.
- Current production-backed mutations (Ask, reply/edit/delete, Lounge send/delete): not repeated to
  avoid certification residue without an authenticated audit state.
- APNs receipt/tap, privacy shield contents, Keychain restoration, Universal Link launch, and Share
  Extension invocation require hardware/system context and were not repeated merely for breadth.
- VoiceOver and Switch Control: structural labels/touch sizes audited; hands-on assistive-technology
  traversal remains untested.
- iPad and landscape: outside the requested iPhone-first runtime capture.
