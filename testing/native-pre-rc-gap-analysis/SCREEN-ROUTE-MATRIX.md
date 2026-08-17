# Screen and route matrix

Evidence: `R` current authenticated Simulator/capture, `A` automated, `S` source/contract trace, `D` physical device required.

| Surface/state | Evidence | Verdict | Notes |
|---|---|---|---|
| Welcome/login, auth presentation/callback | A,S; physical prior | DEVICE CERTIFICATION REQUIRED | Presentation tests pass; current clean-login physical upgrade not repeated. |
| Auth error, cancel, malformed callback | A,S | PASS | Failure categories exist for auth presentation/callback. |
| Floor + attention rail + activity | R,A | PASS | Founder-approved V2, real topic data. |
| Discussions/latest/unanswered/category discovery | R,A | PASS | Founder-approved V2; category routes native. |
| Category collection loading/empty/error | A,S | PASS | Generic collection layer; pagination remains P2. |
| Topic opener/thread/parent jump | R,A | PASS | Founder-approved V2 and real post order. |
| Reply composer, permission/closed/archived | A,S | PASS | Guardian fields control availability; media client integrated. |
| Edit own opener/reply | A,S | PASS | Server `can_edit`, raw load and PUT path. Existing-media runtime after activation still gated. |
| Delete own reply / creator discussion | A,S; prior physical | PASS | Confirmation and safe return preserved. |
| Bookmark add/remove and saved routing | A,S | PASS | Native mutation/list behavior covered. |
| Ask compose/privacy/category/submit | R,A; prior physical | PASS | Native topic result; current media upload is gated. |
| Ask failure/offline/403/422/429 | A,S | NEEDS POLISH | Privacy-safe text exists; physical network transitions pending. |
| Lounge channel/history/pagination/polling | R,A | PASS | Active-only 10s polling, older history, membership checks. |
| Lounge send/delete/emoji/keyboard | R,A; prior physical | PASS | Founder-approved V2; current production attachment rejection intentional. |
| Lounge reconnect/background | A,S | NEEDS POLISH | Preserves history; no realtime transport. |
| Intel landing | R,A | PASS | Founder-approved V2; no fabricated data. |
| Today in Claims / Claims Weather / Field Knowledge | R,A,S | PASS | Authenticated real collections, truthful empty/error. |
| You/self Adjuster Card | R,A | PASS | Founder-approved; real capability-visible fields only. |
| Member Adjuster Card/sparse profile | R,A | PASS | Native route and visibility filtering. |
| Edit Profile/photo/fields/visibility | A,S; prior device | DEVICE CERTIFICATION REQUIRED | Canonical API; next exact-build photo picker persistence not repeated. |
| Activity/contributions | A,S | PASS | Stale/deleted topic filtering covered. |
| Bookmarks/saved empty/error | A,S | PASS | Native route/mutation. |
| Account | A,S | PASS | Bounded member account actions. |
| Notification preferences | A,S | PASS | Server-returned controls only; push status remains separate blocker. |
| Appearance System/Light/Dark | A,S; prior runtime | PASS | Default is Light; persistence covered. |
| Privacy & Account/export/delete/logout | A,S | PASS | Destructive confirmation/support paths retained. |
| Notification center new/replies/all | R,A,S | PASS UI / FUNCTIONAL GAP offline | Founder-approved V2; real empty state. Fetch rejection lacks recovery. |
| Search initial/loading/empty/error | R,A,S | PASS | Founder-approved V2. |
| Search content result → Topic | R,A | PASS | Real `Off Duty` result observed. |
| Search member result → Adjuster Card | R,A | PASS | Real `qa_test` result observed; no private messaging. |
| Onboarding V2 Profile/Licenses/Experience/Preview | A,S; prior evidence | PASS | Versioned NOT_STARTED/INCOMPLETE/COMPLETED; résumé step skipped while OFF. |
| Onboarding skip/new-login reminder/relaunch | A | PASS | Skip != complete preserved. |
| Profile saved-data malformed/legacy/default | A | PASS | Canonical normalizers covered. |
| Signed-out/private-site enforcement | A,S | PASS | No ordinary first-party WebView login fallback. |
| Universal Links topic/category/member | A,S,D | DEVICE CERTIFICATION REQUIRED | Entitlement/AASA valid; exact next artifact tap required. |
| Push receipt/tap/foreground/background | A,S,D | BLOCKED | Source category loss plus production-device proof absent. |
| Share Extension handoff | A,S,D | DEVICE CERTIFICATION REQUIRED | App Group bounded intent structurally passes. |
| Camera/photo library/files | A,S,D | CLIENT READY / ACTIVATION GATED | Physical permission, metadata and upload lifecycle require enabled backend. |
| Offline launch/reconnect | S | NEEDS POLISH | Truthful but no cache; representative physical transition pending. |
| 401/403/404/429/5xx | A,S | NEEDS POLISH | Mutations mostly map safely; notification collection rejection is incomplete. |
| Privacy shield/background obscuring | A,S,D | DEVICE CERTIFICATION REQUIRED | Structural overlay exists; physical app-switcher proof needed. |
