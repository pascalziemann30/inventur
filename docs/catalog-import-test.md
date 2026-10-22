# Controlled catalog test import

Open `InventoryCapture?workflow=import` in the branch preview with the existing development data context. This admin-only workflow always uses the dedicated dev client and the existing expiring test grant. It cannot target an existing outlet or production data.

Supply the reviewed, private article array through the form. Business catalogs, supplier prices and private source material must stay out of this public repository. The backend validates all conversions and count units before writing any catalog records. An internal source key is kept separate from the optional supplier article number.

The backend builds a new test outlet, suppliers, units, one temporary test category, global articles, outlet articles, supplier offers including confirmed receipt-unit aliases, and zero-initialized stocks. Groups contain at most twenty records of the same entity type. Conditional batch revisions prevent two workers from writing a group twice. Reopening the same batch resumes only from a completed checkpoint. A lost or malformed bulk-create response blocks that batch; it never blindly repeats a potentially committed create. Such batches require investigation rather than automatic recovery.

Verification reads every created record again and checks all expected fields and references, zero stock, empty booking journals and the count-unit conversions. Closing a verified test deactivates only its newly created outlet and retains all imported test records and the batch for audit. This is not a destructive rollback and is not a production importer.

Reads remain available to the creating admin after the test grant closes. Other admins cannot operate the batch through this endpoint. Existing entity-level permissions and older production write paths remain separate cutover tasks; this workflow does not claim to resolve them.
