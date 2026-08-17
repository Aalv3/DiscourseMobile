# Phase 1 source and evidence reconciliation manifest

Baseline: `codex/notification-tap-routing` at `7ebf7dc480327ef0a002a6422ecafa27bbe127f6`, matching origin and TestFlight 1.0.0 (2). One worktree is present. Nothing was reset, cleaned, stashed, deleted, pushed, or merged.

## Tracked product and test delta

| Path | Approved mission / disposition |
|---|---|
| `js/Discourse.js` | V2 shell/routing, auth hardening and current Phase 1 push taxonomy. Ship after review. |
| `js/product/DesignSystem.js` | Founder-approved shared V2 tokens. Ship. |
| `js/product/ProductComponents.js` | Founder-approved V2 headers, navigation and shared presentation. Ship. |
| `js/product/ProductScreens.js` | Founder-approved Floor, Discussions, Ask, Intel and You; approved attachment integration; Phase 1 notification status copy. Ship. |
| `js/product/NativeTopicScreen.js` | Founder-approved Topic V2 and attachment integration. Ship. |
| `js/product/NativeLoungeScreen.js` | Founder-approved Lounge V2 and attachment integration. Ship. |
| `js/product/NativeMemberUtilityScreens.js` | Founder-approved Search/secondary surfaces and Phase 1 notification status action. Ship. |
| `js/product/AdjusterCardOnboardingScreen.js` | V2 profile/onboarding composition retained. Ship. |
| `js/screens/NotificationsScreen.js` | Founder-approved Notifications V2 plus Phase 1 loading/error/retry. Ship. |
| `js/screens/NotificationsScreenComponents/EmptyNotificationsView.js` | Founder-approved Notifications V2 empty state. Ship. |
| `js/screens/NotificationsScreenComponents/NotificationRow.js` | Founder-approved Notifications V2 rows. Ship. |
| `js/screens/CommonComponents/Filter.ios.js` | V2 filter compatibility. Ship. |
| `js/secureCredentialStore.js` | Previously tested malformed/legacy credential cleanup; not visual work. Retain and ship after security review. |
| `js/__tests__/authenticatedShell.test.js` | V2 shell and Phase 1 startup push regression coverage. Ship. |
| `js/__tests__/nativeTopicParticipation.test.js` | Topic V2/participation regression coverage. Ship. |
| `js/__tests__/secureCredentialStore.test.js` | Credential cleanup regression coverage. Ship. |
| `js/__tests__/wave2MemberCorrectness.test.js` | Member correctness updates. Ship. |
| `js/__tests__/wave3VisualSystem.test.js` | Founder-approved V2 invariant coverage. Ship. |

Phase 1 also changes tracked core files `js/notificationStatus.js`, `js/pushFoundation.js`, `js/site.js`, `js/site_manager.js`, `js/adjusterNetworkConfig.js`, `js/__tests__/notificationStatus.test.js`, and `js/__tests__/pushFoundation.test.js`. Those changes are bounded to the accepted audit findings.

## Untracked product/test work

| Path | Classification / disposition |
|---|---|
| `js/product/AttachmentComposer.js` | Approved Media & Attachments client UI; retain, ship dormant behind Build 3 gate. |
| `js/product/MediaAttachments.js` | Approved authenticated upload client/markup helpers; retain dormant. |
| `js/product/DiscourseMedia.js` | Approved post/Chat media rendering; retain. |
| `js/__tests__/nativeMediaAttachments.test.js` | Approved media regression coverage plus disabled-gate test; retain. |
| `js/__tests__/notificationsRecovery.test.js` | Phase 1 bounded error/retry coverage; retain. |

## Evidence and references

| Path | Classification / disposition |
|---|---|
| `testing/native-visual-design-v2/reference/` | Founder-owned canonical references. Preserve byte-for-byte; certification input, not app payload. |
| `testing/native-visual-design-v2/captures/` | V2 evidence. Founder-review captures are relevant; numerous intermediate alignment/live/debug captures are stale for final RC provenance. Preserve now, curate by manifest before commit. |
| `testing/native-visual-design-baseline/` | V1 before-state evidence. Preserve. The ZIP is generated evidence and should not enter the app artifact. |
| `testing/native-media-attachments/` | Approved client evidence, including intentional production-policy rejection. Preserve; not production activation proof. |
| `testing/native-pre-rc-gap-analysis/` | Accepted audit and this reconciliation manifest. Preserve as canonical certification documentation. |

## Non-shipping/stale material found

- Intermediate V2 captures named `live`, `alignment`, `current-screen-verification`, `click-test`, and percentage-progress captures are superseded evidence, not current-source certification.
- Baseline ZIP and screenshot PNGs are evidence/generated artifacts, not runtime inputs.
- No DerivedData, archive, IPA, bootstrap bundle, credential file, or temporary authentication tooling is present in the enumerated untracked paths.
- No item was deleted because founder review is required before evidence curation.

## Provenance conclusion

Phase 2 reconciled the approved work into two local commits: an integrated shipping source/test commit and a canonical evidence/docs commit. Superseded V2 captures and the generated baseline ZIP remain preserved on disk and are explicitly ignored through the worktree-local `.git/info/exclude`; they are not part of candidate history. Existing ignored `ios/build/` products likewise remain local-only and were not staged.

The candidate working tree is clean. The branch remains unpushed until separate founder authorization.
