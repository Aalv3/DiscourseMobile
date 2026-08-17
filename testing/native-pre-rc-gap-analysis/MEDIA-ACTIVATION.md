# Media activation

## Founder decision for next RC

Build 3 keeps uploads disabled. The approved client remains compiled and tested, but `adjusterNetwork.features.mediaUploads` is a trusted, fail-closed release gate set to `false`. Ask, reply/edit, and Lounge composers render a compact truthful unavailable state and do not open camera, Photos, Files, or initiate multipart upload.

The current native/backend contracts expose no authenticated preflight capability whose semantics authoritatively combine Discourse `authorized_extensions` and the separate Chat upload policy. An unauthenticated `/site.json` check is forbidden by the private site (HTTP 403), and upload rejection is too late to avoid wasted selection. Therefore the bounded RC uses the explicit founder-approved client gate in addition to—not instead of—the unchanged server rejection. The underlying attachment implementation is retained for later activation certification.

Status: **CLIENT READY / PRODUCTION ACTIVATION GATED**.

## Current client

- Ask, topic reply/edit, and Lounge share one picker/queue/upload lifecycle.
- Camera, multiple photos and Files are exposed through system pickers; previews, retry, removal, privacy reminder and authenticated multipart upload exist.
- Post uploads insert Discourse markup; Chat sends real upload IDs; cooked posts and Chat uploads render.
- Automated tests cover transport, markup order, Chat IDs, rendering and 403/413/415/429 error copy.

## Current production gate

Existing production evidence records `authorized_extensions` empty and Chat uploads disabled. No successful production upload certification exists. This audit did not change backend policy.

## Activation blockers

- Approve extension and MIME/signature allowlist and obtain limits from site configuration.
- Enforce size/type server-side; optionally preflight client-side without treating it as authority.
- Prove malware scanning fails closed.
- Prove private/member access, secure non-predictable URLs, deletion, retention, backups and moderation/reporting.
- `exif:false` prevents picker EXIF return but does not prove uploaded original bytes are stripped. Download and inspect exact uploaded camera/library artifacts; transcode/strip if necessary.
- File links currently open with system `Linking`; prove access works without leaking credentials or publicizing protected media.
- Prove multi-upload partial failure semantics, cancel behavior and no orphaned uploads.
- Complete the physical camera/library denial/recovery and real network-transition checklist in `testing/native-media-attachments/README.md`.

## RC decision

If activation is not approved before the next RC, capability-gate the attach action with truthful unavailable copy rather than allowing users to select files that production must reject. Do not enable extensions merely for TestFlight appearance.
