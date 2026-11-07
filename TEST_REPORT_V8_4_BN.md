# RIHAM v8.4 — Regression Test Report

## Automated checks

- `python -m py_compile app/main.py app/database.py app/models.py tests/test_regressions.py`
- `pytest -q tests/test_regressions.py`
- `node --check` for `app.js`, `admin.js`, `pixel.js`, `info.js`, `motion.js`

Final result: **16 tests passed**. Tests use local SQLite, FastAPI TestClient and mocked Steadfast HTTP responses. No real third-party request is sent. Python compilation and Node syntax checks also passed.

Validation runtime: **Python 3.13.5**. Hosted build pin: **Python 3.12.16** (configured in `.python-version`, not directly exercised in this environment). Core dependencies are pinned in `requirements.txt`; production-only `psycopg[binary]==3.3.8` and `cloudinary==1.47.0` were not installed or exercised here.

## Covered behavior

- Bengali/Arabic-Indic mobile digits and valid Bangladesh operator prefixes.
- Whitespace-only customer name/address validation.
- Atomic stock deduction; no negative stock for sequential competing orders.
- Public order receipt does not expose phone, address or internal fraud fields.
- UTC timestamp serialization.
- Steadfast nested success response, ambiguous timeout guard, manual retry path, atomic concurrent-send claim and duplicate prevention.
- Status machine prevents cancellation after shipment; cancellation returns stock.
- Hidden categories are not exposed through public product APIs, direct product landing URLs or direct order API requests.
- Health endpoint checks the database.
- Production startup guard rejects local SQLite/missing durable configuration.
- Migration does not overwrite an admin-selected photo theme.
- Repeated cancellation does not restore stock twice.
- Whitespace-only store name is rejected.
- SEO description metadata is limited to 160 characters; static assets revalidate.
- A Steadfast HTTP-200 response without tracking identifiers is treated as ambiguous and cannot be retried without manual review.

## Not covered

No live Render, PostgreSQL/Supabase, Cloudinary, Steadfast Merchant Panel, courier webhook, SMS, payment gateway, PostgreSQL multi-connection/load stress test, browser crawler, real mobile browser or Android/Termux installation test. One two-request courier-claim race was simulated against local SQLite. `psycopg` and `cloudinary` were unavailable in this environment. Do not interpret these local tests as production certification.
