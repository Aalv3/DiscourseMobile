# Non-blocking follow-ups

Opened alongside the stale-identity authorization fix. None of these gate that
fix, and none may delay its staging or promotion.

## 1. Misleading reviewer-specific denial copy

`principal_classification_required` is a generic admission denial, but the
native copy presents it as reviewer-specific. Replace it with accurate generic
copy that does not imply a reviewer-only condition. Reviewer-visible copy is
frozen during Apple review of Build 8; schedule after the freeze lifts.

## 2. `/native/v1/authorization-profile` returns 500 on a bad User-Api-Key

A malformed or missing `User-Api-Key` produces a 500 instead of a clean 401.
Server-side fix. It must remain fail-closed: an unauthenticated or malformed
request is denied, only the status and body shape change. Do not weaken
User API authorization while fixing the status code.

## 3. Legal acceptance screen is too long

Consolidate into a concise single acknowledgement UI while preserving
per-instrument and per-version acceptance evidence. The recorded evidence
granularity is the constraint; the presentation is not. Reviewer-visible;
schedule after the Apple review freeze.

## 4. Governed cleanup of qa_test production credentials

Production User API keys 111 and 112 belong to `qa_test`, plus one stale August
session. These need governed revocation with an audit record. Do not touch
`cert_probe_01`. Do not mutate production server state outside an approved
cleanup window.

## 5. `POST-SUBMISSION-HOLD.md` names a stale production OTA group

`testing/native-app-store-readiness/POST-SUBMISSION-HOLD.md` records the
production channel as group `39eb1e9b-8b72-480b-99f1-f52ad6d351fc`
(iOS update `01a01ff3-d501-73b3-b799-2b4cf353efcb`, source
`3fb9de379e499736513d6ade7227b5ce32201ba1`). A read-only channel check on
2026-09-02 shows production has since moved twice and now serves group
`70eebadf-5736-4cd6-a7db-2980a69f0494`, source
`fdb83141879f7b1df60d46a488343563d3bb156e`, published 2026-09-01.

The stale value matters because that document is the stated rollback target
during the Apple-review freeze. Correct it to the live group.

That file is untracked in this lineage — it exists only in the canonical
repository's working tree — so this correction is recorded here rather than
applied to it. Documentation only; it does not gate any fix.

## 6. Founder Production Approval UX / Deployment Gate V2

Production promotion is currently a founder-run CLI step with no in-product or
dashboard approval surface, and the governed rollback target lives only in a
document that has already gone stale twice. Design a deployment gate that
records the approver, the exact certified group, the rollback target, and the
freeze state in one authoritative place.

## 7. Written-but-unwired modules on the certification path

`js/otaDiagnostics.js` (`getOtaDiagnostics`) and
`js/authorizationConsent.js` (`USER_API_KEY_SCOPE_COPY`) are implemented and
unit-tested but imported by nothing. The missing OTA surface is why proving
which bundle a device had loaded required a laptop and a USB cable, which
directly cost a certification cycle. The staging diagnostics block added in
this lane is deliberately temporary; decide whether a permanent, governed
build-identity surface belongs in the product before removing it.
