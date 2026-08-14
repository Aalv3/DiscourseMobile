# Visual gaps

Fifteen visual-system gaps were recorded. These are observations, not redesign proposals.

1. Native launch screen uses the stock gray Discourse bubble and a generic system-gray background.
2. Floor’s large hero is visually dominant even when it contains only “nothing published” copy.
3. Floor and Intelligence repeat rounded cards with weak differentiation between content types.
4. Discussions rows repeat the same card weight and expose little author/category/activity metadata.
5. Category filters can extend horizontally without an explicit cue that more filters exist.
6. Topic starter is boxed while replies are mostly separators, producing mixed visual grammar.
7. Long threads have only a 28-point secondary indent; multiple relationships can become hard to scan.
8. Lounge’s own-message Delete is exposed as persistent inline text, increasing noise in active chat.
9. Ask presents a long vertical sequence of safety card, category cards, inputs, and action with no
   compact progress/grouping treatment.
10. Intelligence’s three destinations have identical card anatomy and generic empty collections.
11. You and Profile use generated initial circles instead of available member imagery.
12. Notifications retains stock Discourse filter tabs and notification-row styling inside a branded header.
13. Settings/subpages rely almost entirely on repeated bordered rows, making hierarchy visually flat.
14. Six bottom tabs are dense; disabling label font scaling avoids clipping but creates an accessibility
   consistency gap at large text sizes.
15. At accessibility-extra-large text, the signed-out welcome headline expands to several nearly
    full-screen lines and moves its primary actions far below the initial viewport.

Light/dark theme tokens and shared safe-area headers are consistently applied structurally. Current
signed-out light/dark/large-text evidence is in `screenshots/`; authenticated variants could not be
recaptured without an approved authenticated Simulator state.
