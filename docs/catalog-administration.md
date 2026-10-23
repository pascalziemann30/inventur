# Linked article administration

Dashboard and History use one native-admin-only workspace. Preserved legacy components are no longer the default routes. Creation links a global item, outlet item, approved purchase/receipt offers and a uniquely initialized zero-stock record. Editing/deactivation preserves stock quantities, revisions, receipts and historical identities. Existing base units are immutable.

The existing outlet anchors a conditional operation ledger. A complete graph plan is persisted before writes; records carry operation markers and new outlet items remain inactive until their dependencies exist. Bulk readback checks payloads rather than response order. Unknown create outcomes are reconciled, never blindly reissued; updates require the expected pre-image or a proven post-image. Competing operations wait. Final verification checks unit/category/offer/conversion/stock linkage and, for initial imports, zero stock and empty journals. Completed ledgers are compacted.

Explicit production preparation from the preview targets only the existing Kuno outlet, through the fixed global Base44 API and the same freshly verified native administrator. No preview service token is forwarded into production. This mode permits managed catalog entity operations only; reads of server-owned drafts/runs require the deployed main runtime. Employee access remains closed.

Proposals remain attached to delivery draft lines. The admin queue opens link/reject or prefills the compact article form. After explicit field review the graph is created and the original position linked; booking is still separate. Booked positions with a differing base-unit price appear in a price queue. Only explicit approval changes item/global/offer master prices and records PriceHistory. Rejection records a decision without changing prices. Receipt snapshots remain immutable.

History reads InventoryRun/DeliveryDraft. Completed-inventory CSV uses stored names, categories, units, prices and counts, retains skips and escapes spreadsheet formulas. It uses UTF-8 BOM, semicolons and decimal commas. Later article edits do not rewrite these values.

Private catalogs, source prices, originals and import reports stay outside the public repository. Unresolved conversions stay excluded from initial import. Full operational end-to-end acceptance is the next fixed launch milestone.
