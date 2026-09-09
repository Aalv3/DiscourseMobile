# Native notification intents

A notification tap resolves to an **intent**, computed from the notification
payload before any URL is built. Four kinds exist:

| Kind | Meaning |
| --- | --- |
| `native` | an existing native screen (Topic, MemberProfile, Collection, Search, Bookmarks, Settings, Ask) |
| `badge` | `granted_badge`, presented by the native BadgeEarned screen |
| `staff_external` | staff-only `/admin`, the single documented external handoff |
| `unavailable` | one explicit bounded state for everything else |

## Why the payload, not the URL

`DiscourseUtils.endpointForSiteNotification` is lossy. A `granted_badge`
becomes `/badges/:id/basic?username=:u`, and `badge_name` is discarded. Every
earlier attempt to route badges started from that URL, which is why they all
ended at a web page: by then the information needed to build a native screen
was already gone. `notificationIntent` reads the payload first.

## Type matrix

**Native.** 1-11, 13, 14, 15, 17, 18, 20, 24, 25, 27, 28, 34, 36, 801, 802 open
Topic. 800 opens MemberProfile. 21 opens Topic when it carries one, and
otherwise resolves to `/u/:me/activity/approval-given`, which the profile
pattern already matches - a valid native destination, left as it was.

**Badge.** 12 opens BadgeEarned.

**Staff external.** 37 and 38 open `/admin` externally, for staff only.
`classifyFirstPartyMemberRoute` returns `privileged_external` only when
`isStaff` is true; a member gets `unavailable`. This is an explicit, documented
exception and does not widen external navigation for anyone else.

**Unavailable.** 16, 19, 22, 23, 26, 29, 30, 31, 32, unknown and absent types.
No silent no-op, no WebView, no external browser, no second authentication.

## BadgeEarned

Renders `badge_name` only, from the payload, with a Close action. It makes **no
network request**, so it cannot stall or fail.

`badge_title` is a boolean in Discourse - whether the badge may be worn as a
title - not descriptive text, and is never rendered. The payload carries no
badge description; showing one would require a fetch, which V1 does not do.

## Certification

Certified in production on 2026-09-09: SHA `ab581ac0`, group
`87d6b1d1-a918-478c-afc9-0cbb27ce6292`, tag `ota-87d6b1d1-ab581ac0`, runtime
`an-ios-android-1.0.0-native-2`. Autobiographer and Basic both passed physical
device validation. Topic/Reply/Mention was not physically exercised - no
fixture existed - and is covered by automated regression.

## What was removed, and why

A first-party WebView fallback and then an OTP-based authenticated WebView
session were both tried and abandoned. The OTP contract itself was eventually
correct - the request succeeded and the confirmation form rendered - but
Finish Login failed with "Missing, invalid or expired token", and more
importantly the architecture was wrong: a member already authenticated in the
app should never perform a second web authentication to read a notification.

Removed with it: `js/webViewSession.js`, the `first_party_web` disposition and
its path allowlist, the WebView destination-bootstrap wiring, and the
`web_session` diagnostic stages. The strict WebView navigation guard, which had
been relaxed to admit the bootstrap, is restored.

One instrumentation lesson is worth keeping: the abandoned diagnostics recorded
`destination_resume: succeeded` for a flow that had actually failed, because
the stage measured navigation mechanics rather than whether a session existed.
A success signal must observe the thing it claims to prove.
