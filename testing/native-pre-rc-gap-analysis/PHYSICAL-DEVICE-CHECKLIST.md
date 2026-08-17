# Exact physical-device checklist

Use the exact production-signed TestFlight candidate; record build/source/update identity first. Use harmless disposable content and clean it.

1. Upgrade Build 2 → candidate; verify session/data migration, Floor, default/current appearance and force-quit persistence.
2. Clean install and normal system login; callback, Keychain session, logout/login, invalid/expired/disabled-account behavior.
3. Push checklist from `PUSH-NOTIFICATIONS.md`, including receipt/tap in foreground/background/terminated states.
4. Open Universal Links for topic, category and member from Mail/Notes; no Safari/PWA fallback.
5. Share URL and text through Share Extension while authenticated and signed out; payload consumed/deleted; no cross-account residue.
6. Edit Profile: camera and photo library permission grant/deny/Settings recovery, upload/persistence only if capability enabled.
7. Media activation (only after backend GO): single/multiple camera/library images, file, retry, oversized/unsupported, metadata inspection, rendering/edit/relaunch/delete in Ask/reply/Lounge.
8. Real Wi-Fi/cellular loss and reconnect during launch, Search, Ask, reply, Lounge send and attachment; no duplicate mutation.
9. VoiceOver traversal on login, tabs, Floor, Topic/composer, Lounge/composer, You, Notifications, Search; labels/order/actions/status announcements.
10. Accessibility-extra-large, bold text, reduced motion, high contrast; keyboard/safe-area and six-tab reachability.
11. Privacy shield in app switcher/background; screenshots contain no tokens/private payloads.
12. Final bounded content smoke: Floor → Discussions/category/topic/reply/edit/delete → Lounge → Ask → Intel desks → You/profile → Search member/topic → Bookmarks/settings.
