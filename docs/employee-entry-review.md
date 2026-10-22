# Passwordless employee entry: current integration boundary

The agreed user experience remains unchanged: open Inventory from the Shift Control icon, choose Employee or Administrator, and enter the employee workflow without an individual employee account or additional employee password. Do not introduce per-person accounts or a new device-approval screen as part of this work.

## Verified current behavior

- The inspected `pascalziemann30/shiftcntrl` main version of `src/components/AppShell.jsx` opens a separate inventory URL using an ordinary external link. That link does not pass a signed location or role context. This is a code observation, not a live authentication test on a staff iPad.
- The inventory application's existing employee card stores a browser-local role and selected outlet. That is a navigation choice, not server-verified authorization. The existing administrator password comparison is also client-side; its literal value must not be copied into reports or new code.
- The newer scan, delivery-draft and inventory-run endpoints authenticate a Base44 account before operating. They are still dev-only and their write window is closed. Therefore the existing freely accessible employee card is not yet an accepted passwordless entry into these newer endpoints.
- Several legacy catalog and stock entities retain permissive direct entity policies. New draft/run/scan protections alone do not close those older write paths. Production cutover requires checking the complete path, not merely hiding administrator buttons.

## Completed local workflow check

`tests/inventory/workflow-integration.test.mjs` connects the real import, scan, delivery and inventory services through their actual persistence adapters, using an in-memory entity API and synthetic receipt output. The location actor represents a shared employee context; it is not a new personal account.

The test proves explicit human review, required name-based identity confirmation, receipt-price isolation from the master price, unknown-item proposals without automatic creation, partial delivery posting, hidden expected stock before counting, explicit skipping, employee inventory completion, idempotent retries and rejection of a foreign outlet. It does not prove live anonymous access, camera behavior, OCR quality, hosting permissions or direct entity-policy enforcement.

## Next implementation boundary

Connect the existing Employee card to a server-enforced, restricted employee context for the intended outlet while keeping the two-card interface. The choice of card, browser storage, arbitrary URL parameters or a referrer must never confer administrator rights. Administrator operations must remain separately protected. Check how the deployed public app is currently admitted by Base44 before activating any broader anonymous write capability. Preserve the user's passwordless employee requirement; do not treat a personal-account rollout as a prerequisite.

No entry-screen, production permission, employee-account, device-approval, credential or public-access change was activated during this review. The complete live employee acceptance remains open.
