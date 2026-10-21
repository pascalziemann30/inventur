# Inventory foundation: units and repeat-safe booking

This is the first backend increment. It adds structured purchasing/counting data and a disabled booking endpoint. Existing screens, data, stock write paths and permissions are not switched over by this change. No real supplier catalog, prices, customer details or imported articles are included.

## Data and quantity semantics

- `SupplierItem` identifies an exact supplier article and purchasing unit. Preserve article numbers as text, including leading zeros and punctuation. A lookup key is a matching aid, not a database unique constraint.
- `base_quantity_per_purchase` converts a purchase into its inventory base unit. Unit codes are scoped to that supplier article. A supplier's ST may mean a whole cake while an inventory Stk means a single portion.
- `OutletItem.count_units` holds separately labeled counting inputs. Fractions are supported for packages; `whole_numbers_only` allows whole cakes plus loose portions.
- `OutletItem.net_purchase_price` means the approved price per inventory base unit. Purchase price and receipt price are separate values.
- `DeliveryLine` retains unresolved/proposal/ready/booked states and a confirmed conversion snapshot. Article and price requests have their own models. Creation, confirmation, proposal review and UI wiring follow in the next increments.
- Quantities accept plain decimal numbers or decimal-comma strings, with up to six decimal places. Missing values, negative values, scientific notation and ambiguous grouping are rejected. Products requiring finer precision are rejected instead of rounded. Arithmetic uses scaled integers; stored values must round-trip exactly.

## Stock write invariant

`bookStockOperation` changes quantity, revision and a durable booking receipt in one conditional write to the **same stock document**. The condition includes record ID, outlet and expected revision. A competing write forces a fresh read. No read/add/unconditional-update fallback exists.

The receipt is the authoritative proof of the stock effect. Repeating a persisted line returns that receipt. Reusing its operation key with different quantity, price or conversion information is rejected. A missing line acknowledgement may be retried without applying stock again. A separate StockMovement projection and the visible parent delivery status are not implemented in this increment; neither is used as proof that the stock write succeeded.

Inventory-set operations additionally require the revision captured by the counting session. A delivery that arrived since that snapshot blocks finalization rather than being silently overwritten. A replay of a completed count returns its receipt and does not reset a later delivery.

The journal is capped at 1,000 operations per stock record. New operations stop at that limit; historical receipts are never silently pruned. A durable archival/deduplication design is required before increasing or removing this cap.

## Endpoint boundary

`bookDeliveryLine` accepts only `{ "delivery_line_id": "..." }`. It loads confirmed server data, verifies the authenticated user and assigned outlet, follows delivery/article/supplier/global-unit references, and derives quantities and its operation key itself. Browser-supplied roles, amounts and prices are rejected. The endpoint never changes the article master price.

The current replay key protects the **same persisted delivery line**. Duplicate uploads that create different documents are not yet deduplicated. The document creation/confirmation service must establish one canonical receipt and stable line identities before this endpoint can be connected to the scanner. Do not deduplicate by product name or remove repeated lines from a multi-page receipt.

## Disabled until platform verification and cutover

`INVENTORY_BOOKING_ENABLED` must remain unset. The endpoint returns 503 unless an operator sets it to `verified-v1` after all release prerequisites below are satisfied. The browser cannot set this switch.

1. Deploy into an isolated test environment and confirm schema/function bundling with SDK 0.8.56. The repository's older functions retain their current SDK version.
2. Execute `verifyBookingStorage` as an authenticated admin with `INVENTORY_STORAGE_PROBE_ALLOWED=test-only`. It uses only disposable `BookingProbeStock` records, never OutletStock, and reports cleanup. Leave the diagnostic switch unset afterward. No probe has been executed on Base44 as part of the local tests.
3. Confirm all four platform checks pass: concurrent calls for the same line, concurrent different lines, stale inventory revision, and retry after a committed write whose response was lost. Also require `cleanup_completed=true`. This diagnostic does not validate employee permissions.
4. Implement the line creation/confirmation workflow, frozen conversion snapshots, canonical receipt identity, proposal review, history projection/reconciliation and parent status display. A line in `ready` or `booked` must never be editable through a generic mutation route.
5. Replace all direct browser stock writes, including the old single-item count, scanner and deferred transfer/waste paths. Then deny direct create/update/delete on OutletStock and route these operations through authenticated server functions. Do the same for stock movement projections and admin-only master-price changes. The old open rules are deliberately not changed before their replacement paths are available.
6. Using actual employee credentials, verify allowed-outlet booking and rejection of foreign outlets, direct stock writes, article approval and master-price approval. Restrict the client-readable journal if it exposes more historical information than that employee should see.
7. Initialize exactly one stock record per outlet article with revision zero and an empty journal. Require valid supplier/category/unit/global references. Do not create a second stock automatically when a link is missing or duplicated.
8. Re-run end-to-end UI and export checks before enabling. No article catalog import belongs in this draft.

Local concurrency tests use an atomic in-memory store. They validate our algorithm under that contract and **do not establish Base44's actual conditional-write guarantee**. The adapter uses the documented `updateMany(query, {$set: ...})` shape and strictly checks its response. If that contract cannot be demonstrated in the platform, keep the endpoint disabled and replace the persistence strategy. A preliminary lookup or an in-memory lock is not a substitute.

## Verification

`npm run test:inventory` runs dependency-free Node tests for conversions, blank/zero handling, authorization, reference validation, concurrency, lost responses, retry content conflicts and stale counting snapshots. The storage diagnostic itself is tested against an isolated fake entity. CI also checks the TypeScript entry syntax and schema JSON syntax; these checks do not deploy or validate schemas against Base44.

Official references:

- [Entities API, including conditional update methods](https://docs.base44.com/developers/references/sdk/docs/type-aliases/entities)
- [Entity schema types and the absence of unique constraints](https://docs.base44.com/developers/backend/resources/entities/entity-schemas)
- [Function packaging, shared files and runtime secrets](https://docs.base44.com/developers/backend/resources/backend-functions/overview)
