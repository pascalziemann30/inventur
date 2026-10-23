# Administrator access and prepared data rules

The two-card entry remains. Employee access uses the verified Shift Control location session. Administrative pages mount only after a fresh native Base44 identity with an exact `admin` role is confirmed. Stored browser role labels and the old shared-password comparison no longer grant access. The backend likewise requires a native administrator on legacy native-identity routes; employees use the signed location endpoints.

A branch client explicitly sends `X-Data-Env: dev`, including legacy administration, so following an internal link cannot silently select production data. Administrator navigation preserves the development parameters. The app homepage is the two-card entry.

## Approved data rule activation

`security/pending-entities/` contains all 25 proposed schemas. The owner explicitly approved app-wide activation. The reviewed rules are now copied into `base44/entities/`; platform application and native read checks are verified separately. The retained copies document the approved target. No records, properties or required fields are removed. The corresponding change plan and baseline manifest are reviewable in `security/`.

- Nine server-owned entities deny direct client reads/writes, including administrator clients. Their approved handlers use backend service access after authorization.
- The remaining entities require the native Base44 administrator role for direct CRUD. Employees read/count/scan/book through the verified location handlers instead of editable profile fields or arbitrary outlet selectors.
- Legacy administrative stock editing remains restricted to trusted native administrators; this is not a new atomic stock-management API.

Base44 describes data/settings as shared between branches and data-structure editing as a main-level operation: https://base44.com/blog/introducing-branches . Treat entity permission activation as an app-wide rollout, distinct from a preview. The prepared schemas must be reviewed/applied deliberately; the activation commit must be checked against the live platform before declaring it effective.

Before declaring the access-control step complete: apply the prepared rules in the intended app; verify anonymous/native non-admin denial against real existing test records; verify native admin access and service-backed employee workflows still work; check that internal server-only records cannot be edited directly. A new employee connection test still needs an explicit bounded grant. Do not merge or publish merely to test a UI change.

Legacy export endpoints now check native administrator identity before reading input/data. Two pre-existing packaging blockers were corrected in the guarded exports: duplicate Excel output variable declarations and missing PDF helper paths. Actual export content/layout acceptance remains a separate functional check.

Tests cover role spoofing, failed identity checks, all route exceptions (including diagnostic query combinations), branch data isolation, prepared schema policy completeness and unchanged fields, native staff profile bypass, signed employee context regression, and denial before input/data access in legacy export/maintenance entrypoints.

`verifyInventoryAccess` is a native-admin-only, exact-origin, dev-only read check. It never forwards the caller token/cookie to its anonymous SDK client, creates no fixtures, and returns only permission outcomes. Tables without existing test records are explicitly untested. It does not claim a write-operation probe or a separate native non-admin account test.
