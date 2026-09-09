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

## 8. HIGH — Edit Profile shows no profile photo controls on device

Physical iPhone testing found no way to add, change, or remove the member
avatar in the native Edit Profile screen. Recorded for the immediate
post-certification profile polish pass; not touched during auth certification.

### Correction to the diagnosis

The native photo editor is already built. `js/product/NativeProfileScreen.js`
renders, at the top of the editor, the current `MemberAvatar` (or the pending
local preview), a **Change photo** action and a **Remove photo** action. The
supporting pipeline exists and is wired end to end:

| Requirement                                     | Status                                                                                                                                                         |
| ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Avatar shown prominently at top of Edit Profile | Built                                                                                                                                                          |
| Change photo action                             | Built                                                                                                                                                          |
| Choose from Photo Library                       | Built (`ImagePicker.launchImageLibraryAsync`, square crop, quality 0.85)                                                                                       |
| Take photo with Camera                          | **Missing — the only genuine UI gap**                                                                                                                          |
| Remove/reset photo                              | Built, with a confirmation alert                                                                                                                               |
| Permission / error / loading states             | Built (`photo_permission_denied`, `profileSaveErrorMessage`, `submitting`)                                                                                     |
| Reuses Discourse's avatar pipeline              | Built — `uploadProfilePhoto` posts to `/native/v1/profile/photo` and requires `card.photo.delegatedTo === 'discourse-avatar'`. No parallel image system exists |
| Image type/size validation                      | Built (`unsupported_profile_photo_type` in `js/product/profileSaveState.js`)                                                                                   |
| Immediate avatar refresh across native UI       | Built (`js/product/avatarAuthority.js` publishes the new template)                                                                                             |

The entire block is gated on the server capability `card?.photo.enabled`, and
`uploadProfilePhoto` additionally fails closed with `photo_capability_disabled`
unless `photo.enabled`, `photo.editable`, and the `discourse-avatar` delegation
are all present.

**So the controls were absent on device because the server capability is off,
not because the UI is missing.**
`testing/native-app-store-readiness/POST-SUBMISSION-HOLD.md` states this
deliberately: "Keep `structured_profile_photo_enabled=false` during review",
and names profile-photo activation as the first bounded post-freeze
server/privacy certification lane.

### Actual work remaining

1. **Server/privacy lane (the real blocker).** Complete the deferred
   certification the hold document already scopes — storage and privacy audit,
   MIME and size validation, EXIF/GPS stripping, signed-out visibility,
   moderation/removal/cache behavior, deletion behavior — then enable
   `structured_profile_photo_enabled`. The native UI needs no change to appear.
2. **Camera capture (native, small).** Add a "Take photo" option beside
   "Choose from library", using `ImagePicker.requestCameraPermissionsAsync` and
   `launchCameraAsync` with the same crop, quality, and
   `normalizeProfilePhotoPickerAsset` normalization. `NSCameraUsageDescription`
   is already declared. Note that App Store readiness item P1.7 proposes
   removing `NSMicrophoneUsageDescription`; the camera string must stay.
3. **Web parity audit (unverified here).** Whether the web member profile
   exposes the same capability could not be checked from this repository. Audit
   before activation so both surfaces agree, and confirm
   `/native/v1/profile/photo` stays compatible with the Discourse avatar
   contract rather than diverging.
4. **Re-verify on device after activation** — the capability gate means this
   cannot be certified while the flag is false.

## 9. P2 — granted_badge notification tap has no destination

A `granted_badge` notification (observed with Autobiographer) marks itself read
when tapped but produces no navigation: the member is left where they were with
no destination opened.

Filed during the 2026-09-08 production certification of
`dad0af191716aca8d33c6afe58900e70d2be29e4`. **Not a regression from that
change** — it is a pre-existing native UX defect in notification routing and was
explicitly excluded from that certification.

`js/DiscourseUtils.js:38-40` does map notification type 12 to
`/badges/{badge_id}/basic?username={username}`, so an endpoint is produced. The
defect is therefore downstream of that mapping: either `data.badge_id` is absent
on the payload, or the resulting web route does not open a native destination.
Confirm which before changing the mapping.

Marking-as-read succeeding while navigation silently does nothing is the part
that matters: either open a destination or leave the notification unread.

### 2026-09-09 — OTP request contract corrected (PR #20)

PR #19 shipped the authenticated WebView path and failed device validation at
step A. The device request ledger showed, twice:

```
settled  PUT:/notifications/read        success
started  POST:/user-api-key/otp
settled  POST:/user-api-key/otp         failure  4xx   (~140ms)
```

Proven from `app/controllers/user_api_keys_controller.rb`:

```ruby
def require_params_otp
  %i[public_key auth_redirect application_name].each { |p| params.require(p) }
end
```

`application_name` is required and was omitted — `ParameterMissing`, 400, before
any OTP was minted. A second contract issue in the same read: `create_otp` uses
`respond_to` with both an html and a json branch, and `site.jsonApi` sends no
`Accept` header, so without an explicit `.json` the server takes `format.html`
and answers 302 to the custom scheme, which `fetch` cannot follow.

Ruled out, so they need not be re-investigated: the redirect allowlist (it
contains both `adjusternetwork://auth_redirect` and
`adjusternetwork://adjusternetwork.org/auth_redirect`), the `one_time_password`
scope (present), `meets_tl?` (groups `1|2|10`), and credential retirement (which
requires a 401 with the exact `invalid_user_api_credential` /
`invalid_or_revoked_or_expired` tuple).

The dialog was working as designed but was the only observable, so a 400 and a
decrypt failure were indistinguishable on device. Bootstrap failures now record
a coarse stage — `otp_request`, `otp_response_parse`, `otp_callback_parse`,
`otp_decrypt`, `otp_validation`, `webview_bootstrap`, `destination_resume` — and
a status class through the existing `profileDiagnostics` allowlist. Read them
with `yarn device:harness profile-diagnostics`. No bodies, keys, tokens, OTP
values or URLs are recorded.

Item 9 stays open until device validation passes on the corrected contract.
