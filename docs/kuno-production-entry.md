# Kuno production entry: prepared, not activated

The existing two-card entry remains. Shift Control's published inventory icon requests a server-signed, 90-second launch for its freshly authenticated native app member. No personal inventory account, outlet choice or additional employee password is introduced. The existing source account requirement is unchanged.

The receiver maps the exact Kuno source application ID to the exact existing production Kuno15 outlet ID in server code. It never derives this mapping from names, browser storage or URL parameters. The production mapping is deliberately restricted to this one deployment; adding another outlet is a later explicit change.

## Runtime separation

Both applications default to a closed production gate. `INVENTORY_KUNO_PRODUCTION_ACCESS` must contain an exact object with boolean `enabled` and positive integer `revision`, for example `{"enabled":false,"revision":1}`. This configuration contains no secret. At the coordinated release, set `enabled` to true in both apps. Increase the receiver revision whenever revoking/replacing a grant; existing cookies then fail on their next request. Setting enabled to false blocks all operational requests immediately after configuration reaches the runtime.

The permanent grant is independent of the 15-minute development write window. Development setup, catalog test import and storage diagnostics keep their development-only restrictions. Production does not make those tools usable against production records.

Each production endpoint requires the fixed public Origin, explicit prod context, its own platform app ID, the canonical Base44 API and a main/published runtime. Branch runtimes are refused before creating a privileged client. These runtime-header expectations still require a single native check when the coordinated release is deployed; synthetic tests do not establish actual platform header values or cookie forwarding in production.

Production employee cookies have a separate `__Host-` name and are Secure, HttpOnly, SameSite=Strict, with at most one hour lifetime. The fixed mapping, its configuration revision and the actual outlet's active state are checked on every employee request. Environment is part of the signed claims. Development tokens cannot be exchanged or replayed as production sessions even though the existing server-only launch and session keys remain in use. Those two independent keys retain their historical `_DEV` setting names; no new key generation or client exposure is needed for this change. A later credential rotation is separate from the release.

The production icon targets only the fixed public InventoryCapture route with workflow=entry. It cannot carry preview/function/server/data-environment overrides. If the exchange or protected-cookie roundtrip fails, access remains closed and the user is directed to reopen Inventory from Shift Control. There is no fallback into an administrator identity.

## Acceptance boundary

Prepared code and tests are not a production release. Before enabling the gate: complete the approved catalog/administration and end-to-end acceptance work in ABSCHLUSSPLAN.md (private workspace file), merge/release both reviewed branches, then check the real icon → employee → Kuno15 → reload path once. Do not create invented deliveries in operational stock for that check. Keep both development gates closed. No production records or permissions were changed by preparing this implementation.
