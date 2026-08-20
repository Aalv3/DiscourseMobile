# Native media attachment certification

## Simulator evidence

- `captures/01-ask-selected-photo.png`: Ask composer selection, preview, removal state, and privacy reminder.
- `captures/02-reply-selected-photo.png`: Topic reply composer selection and preview.
- `captures/03-lounge-selected-photo.png`: Lounge composer selection and preview.
- `captures/04-production-upload-policy-rejection.png`: truthful production rejection while uploads are disabled by site policy.

No certification post or Chat message was created. The selected local asset and draft text were removed after capture.

## Production dependency

Production currently sets Discourse `authorized_extensions` to an empty value. This intentionally rejects every upload pending the existing metadata/security decision. The native client must not claim end-to-end upload support until the backend gate is approved, activated, and recertified.

## Physical iPhone checklist after backend activation

1. In Ask, choose one approved non-claim photo, verify preview/removal, submit a disposable topic, verify rendering, then delete it.
2. Select two approved photos, verify ordering and partial-failure handling, then remove them without submitting.
3. In a disposable reply, test an approved photo and approved file, verify rendering after relaunch, edit without losing media, then delete the reply.
4. Confirm Lounge remains text-only while secure Chat uploads are disabled.
5. Invoke Take Photo, deny camera once, verify recovery guidance, then grant access and capture an approved test image.
6. Deny photo-library access once and verify the Settings recovery action.
7. Exercise an unsupported type, an oversized file, network loss, retry, and removal before send.
8. Download the exact uploaded image and inspect metadata independently; do not certify GPS/EXIF stripping from picker settings alone.

Never use claim-specific photos, documents, addresses, policy numbers, or other identifying claim information in certification.

## Deferred non-blocking product defect

- Floor retains its mounted `/latest.json` snapshot after an Ask submission, so the new topic may not appear in Network activity until Floor is refreshed or the app is relaunched. This is separate from media activation and must be addressed during the next authorized Floor lifecycle pass.
