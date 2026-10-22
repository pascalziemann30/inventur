# Receipt scanning – dev-only connected workflow

`/InventoryCapture?workflow=scan` adds photo/file intake before the existing delivery review and booking stages. It uses the actual signed-in account and outlet assignment for both employee and admin users. The existing production scanner is not switched over yet; its unsafe name-based auto-accept and same-name row deduplication remain reasons to keep production rollout blocked until the coordinated replacement.

## Intake and reading

One JPEG, PNG, WebP or PDF, at most 10 MiB, 20 model-reported pages and 100 positions. File signature and MIME must agree. SVG, HEIC, URL-only sources and arbitrary remote URLs are rejected. The mobile camera input requests the environment camera; browser/device behavior still needs a genuine iPad check. Multi-photo batching is deferred; multi-page receipts currently require one PDF.

The backend checks authentication, dev data header, the bounded test-write grant, outlet and supplier before calling any integration. UploadPrivateFile stores the original privately; only short-lived signed URLs are issued after authorization. DeliveryScan denies every direct client entity operation. Files are hashed server-side; identical files within an outlet/supplier are resumed by the same owner or blocked for another owner. Race-created duplicate records stop rather than auto-select. This hash is a replay aid, not canonical document identity: a changed photograph has a different hash. The existing supplier/reference registry protects later bookings. Private upload followed by a failed record write may leave an orphan file; automatic deletion is not implemented.

Two separate InvokeLLM calls read the same original without receiving the catalog or the previous result, with internet context disabled. They are correlated AI reads, not independent OCR engines or a statistical accuracy guarantee. Raw fields remain literal strings. Missing values stay blank, not zero or a guessed unit. No master prices, conversion factors, products, confirmations or stock writes are generated. Repeated product rows remain separate with stable row ids; nothing is deduplicated by name. Quality flags are model diagnostics, not a measured image-quality certificate. An unreadable result is rejected; limited quality and disagreements require visible review.

Both raw reads are retained. Comparison flags different headers, page counts, row counts and row fields. Extra second-read rows remain visible in the complete control reading. Two reads can still omit or misread the same information. The human must compare every original page and can add missing rows. No claimed percentage or reliability promise is made before testing representative real photos.

## Human review and handoff

The original appears beside editable extracted fields; each row requires a check. Changing a row clears its check. Reference, valid date, chosen supplier, all pages, completeness and net price basis need explicit review. Gross/unknown price basis never silently converts to net. The first read's rows cannot be dropped during handoff; added rows also require review. The checked payload is frozen with actual actor/time before an unconfirmed DeliveryDraft is created using a stable start key. A lost acknowledgment resumes this exact payload rather than creating another draft. Matching and actual stock booking remain separate explicit steps. No genuinely new master article is created.

The new approximate word matching helps suggestions with limited spelling/abbreviation differences, but numbers, supplier identity and package identity are not inferred from fuzzy similarity. Exact supplier SKU and purchase unit can identify a candidate; changed descriptions still need acknowledgment. Name-only suggestions require the existing admin proposal/link review. No learned alias auto-approval is introduced.

## Validation and remaining acceptance

126 automated tests cover file signatures, missing values, repeated lines, dual-read differences, private uploads/hash recovery, unreadable documents, mandatory review, immutable retries, actual-user scope, approximate suggestions and API rejection of URLs/production/closed test grants. Local app build and targeted lint pass. These fixture tests do not prove the actual hosted integration or iPad camera; runtime results are recorded separately after execution.

Before rollout: representative digital PDFs and genuine iPad photos (sharp, rotated, shadowed, crumpled, cropped, multiple pages); field-by-field comparison against manually transcribed truth; no false automatic approvals; safe rejection/recapture and full employee-login/outlet acceptance. A readable synthetic screenshot is not a photograph and cannot establish camera accuracy. Retention/export and recovery of orphan private files remain operational work. No production catalog import, merge or publication is part of this package.

References: Base44 SDK integration documentation https://docs.base44.com/developers/references/sdk/docs/type-aliases/integrations ; mobile capture behavior https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Attributes/capture .
