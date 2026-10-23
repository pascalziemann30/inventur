# Authenticated inventory sessions – test rollout

`/InventoryCapture?workflow=server` connects the counting workspace to the new `inventoryRuns` backend function. The ordinary inventory route is retained until the full application cutover. `InventoryRun` denies all direct client reads and writes; the endpoint checks the actual Base44 user and outlet assignment before projecting or changing a session. Expected quantities are omitted from open/skipped rows and revealed only with a confirmed count. Current user-entered quantities are recomputed on the server using a frozen catalog snapshot.

## Non-production gate

All calls require `X-Data-Env: dev`. Mutations in `inventoryRuns` and every call to the separate admin-only `inventoryTestSetup` additionally require a current `INVENTORY_SESSION_TEST_ALLOWED` grant. Authorized `get`/`list` session reads remain available after expiry; `get` marks the result `read_only` and the UI disables editing. Production reads are also rejected. Its format is `test-only|issued Unix milliseconds|expires Unix milliseconds`, with a maximum duration of 15 minutes. A dedicated frontend SDK client pins this test workflow to `X-Data-Env: dev`, independently of the production client. The installed SDK 0.8.56 forwards `X-Data-Env` from the function request to entity operations. Production calls remain disabled regardless of the existing delivery booking switch. These changes are not a production permission cutover.

The test setup can create a clearly named synthetic outlet, four synthetic articles, supplier/category/unit links, and initialized stocks in Test Data only. It can inspect only outlets whose code begins with `INVENTORY-TEST-`, and simulate an idempotent delivery of two litres to the synthetic milk article. It does not import the real catalog or parse a real receipt.

## Writes and recovery

- Starting snapshots active articles for the requested interval on the server, along with exactly one stock record, base unit, approved base price and count conversions. Missing links/price/conversion block the start.
- A start key recovers an uncertain creation response. Base44 has no verified unique constraint: two racing creates are detected and cannot finalize automatically. This detection is not presented as a uniqueness guarantee.
- Draft writes use a document revision and an atomic request receipt. Exact retries return the same acknowledgment; another device's revision is never overwritten. A full snapshot cannot add/remove article IDs or override server metadata. Receipts are retained up to 2,000 writes, after which drafts stop rather than silently discard idempotency evidence. Catalog/list queries stop at the documented implementation bound instead of silently omitting records.
- Finalization conditionally freezes all entries, then books each counted stock with an operation ID derived from session, article and count version. Empty rows prevent freezing; skipped rows do not change stock. Session completion requires all counted rows to have durable receipts and acknowledgments. A failed acknowledgment is recoverable from the stock journal.
- A delivery after the captured stock revision causes a visible conflict. Partial completion is preserved; repeat finalization only acknowledges/retries the remaining rows.
- Explicit recount uses a quantity-preserving `inventory_fence` journal operation before reopening an unbooked row. The fence increments the stock revision, preventing an older in-flight finalizer from applying the superseded count. This is not a count, receipt or quantity adjustment and must be excluded from future business movement reports. A previously committed count cannot be reopened under the guise of a missing acknowledgment.
- Reopened rows get a new count version and captured stock revision. Other frozen/booked rows remain immutable. An uncertain fence/session write can be retried with the same request ID.
- If another device changes a draft, the UI blocks completion. Explicit reload first retains the local input as a separate comparison copy in this tab's session storage; it does not silently merge or overwrite either set of counts.

## Current release limits

Existing direct client write rules on OutletStock and the legacy article models remain unchanged. The new endpoint therefore remains restricted to the test environment until every old stock-writing path is replaced and permissions are closed together. Real employee accounts and assignments must still be tested; unit tests with employee identities are not a substitute for that end-to-end check. A separate read-only delivery position review is now prepared (see `delivery-review.md`). Delivery scanning, proposal approval, canonical receipt deduplication, business history projection and the locally prepared real catalog import remain subsequent work.

## Observed Base44 test run on 2026-10-21

A synthetic four-article catalog was created exclusively in Test Data. A monthly inventory was saved, reloaded and resumed with 2.5 milk packs, an explicit zero, two cakes plus three portions (27 pieces), and one explicitly skipped paper article. A simulated two-litre delivery caused a conflict only for milk; the other counted positions were committed once and the skipped stock remained at 12 rolls. An explicit milk recount to 4.5 litres then completed the session. Repeating completion from a stale second window did not add stock writes. Observed stock journal counts were milk 3 (delivery, fence, count), cake 1, fruit 1, paper 0.

A weekly inventory contained only its one assigned article. Two windows editing that same draft preserved the first saved value (3), rejected the stale second write (5), and retained the second value as a separate comparison copy when reloading. No stock was booked for this open draft.

With the real admin client, direct session get/create/update/delete attempts were denied with HTTP 404/403/403/404. An authorized server reload still found the completed session afterward. The diagnostic helper accepts a delete denial via 403 or 404 only together with an unchanged authorized before/after record; a missing record or a validation failure is not a passing permission test. This is not an actual employee-login test.

The bounded test grant expired and a subsequent fixture-inspection request returned 503. The configuration was left at `disabled`. The production OutletItem table was separately selected and remained at zero. Runtime screenshots and synthetic record IDs are retained locally, not in the public repository.
