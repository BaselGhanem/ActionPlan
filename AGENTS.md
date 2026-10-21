# Prototype Instructions

Run the local server yourself and open the preview in the browser available to this environment. Do not give the user server-start instructions when you can run it.

Before making substantial visual changes, use the Product Design plugin's `get-context` skill when the visual source is unclear or no longer matches the current goal. When the user gives durable prototype-specific design feedback, preferences, or decisions, record them in `AGENTS.md`.

When implementing from a selected generated mock, treat that image as the source of truth for layout, component anatomy, density, spacing, color, typography, visible content, and hierarchy.

Build app UI in `src/`. Keep `.openai/hosting.json`, `worker/index.js`, `scripts/prepare-sites-build.mjs`, and `tests/sites-worker.test.mjs` intact so the same local prototype can be handed to Sites. Before a Sites handoff, run `npm run build` and `npm run test:sites`; the build must leave `dist/client/index.html`, `dist/server/index.js`, and `dist/.openai/hosting.json`.

## ActionPlan decisions

- Arabic RTL; Cairo; deep blue #0B457F, orange #F07D00, background #F8FAFC.
- Approved first generated direction: right blue sidebar, center customer directory, left allocation drawer; mobile cards and full-screen allocation.
- 2027/USD; one account per team; shared customers matched by code; classification per team.
- Admin alone manages roster uploads/users. Marketing Manager manages budgets/activity types/activities and reads all reports.
- Firebase Spark only: use the client Firestore SDK and tested Security Rules, with atomic activity + central finance + immutable audit writes. No Cloud Functions or external backend.
- Monetary logic uses integer cents. Use template literals for JavaScript logic strings.

- Rules validation supports up to 8 clients and 8 participating teams per activity; keep limits visible and consistent in UI and rules.
