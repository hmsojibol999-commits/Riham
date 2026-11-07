# RIHAM Store v8.4 — Engineering Handoff

## Scope

This is a hardening pass on the existing v8.3 project, not a full rewrite. The storefront remains a one-product-per-order COD store with one shared admin access key.

## High-risk changes in this build

1. **Steadfast:** parses nested `consignment` fields, accepts the numeric success status used by the documented v1 response example, rejects overlong addresses instead of silently truncating them, carries the customer's delivery note, and persists a pre-request `submitting` marker. Network/timeouts or missing tracking identifiers become `unknown`; a second request is blocked until an admin confirms the invoice is absent in the Merchant Panel and explicitly resets the marker.
2. **Production storage:** production startup rejects absent/SQLite database URLs. Production image upload rejects local storage and requires Cloudinary credentials. Demo seeding is disabled in production.
3. **Demo seed and migrations:** local seed runs only when the catalogue is entirely empty; it no longer modifies existing products, gallery, theme or size options. Startup migration no longer forces the theme to white. Missing courier columns are added.
4. **Inventory:** order stock is decremented by conditional SQL updates inside the order transaction. Cancellation/reopen transitions use compare-and-set status changes in the same transaction to avoid duplicate stock restoration.
5. **Orders and phone:** Bengali/Arabic-Indic numerals normalize to ASCII; phone prefixes `013`–`019` are enforced. Customer name/address whitespace is trimmed. Duplicate errors do not reveal an earlier invoice.
6. **Privacy:** customer receipt omits phone, address and fraud-review details. Admin-only API still has those fields.
7. **Time and health:** timestamps include explicit UTC `Z`; invoices use Asia/Dhaka calendar date; health performs `SELECT 1`.
8. **Storefront/admin:** hidden category products are removed from customer endpoints and direct landing URLs, Admin order polling detects new IDs, failed status updates refresh the selected value, expired sessions return to login, and courier retry requires explicit review.
9. **Static/SEO/analytics:** static assets revalidate on deploy, meta descriptions are shortened, lower images lazy-load, COD submission is tracked as a lead instead of a false completed purchase.

## Files to know

- `app/main.py`: FastAPI routes, validation, orders, courier and startup.
- `app/database.py`, `app/models.py`: SQLAlchemy setup/schema.
- `app/static/app.js`, `admin.js`, `pixel.js`: storefront, admin and analytics logic.
- `tests/test_regressions.py`: local regression tests.
- `requirements.txt`: core local runtime.
- `requirements-production.txt`: adds PostgreSQL/Cloudinary integrations.
- `.env.example`: local configuration template.

## Verified in this environment

- Python syntax compilation for app modules.
- FastAPI TestClient regression suite (see `TEST_REPORT_V8_4_BN.md`).
- Node syntax checks for frontend JavaScript.
- Local SQLite/TestClient tests for order stock changes, privacy receipt shape, phone normalization, hidden category, health, status transitions and mocked Steadfast response/timeout guard.

## Not verified / remaining work

- Real Steadfast API, Merchant Panel, courier webhooks or status polling.
- PostgreSQL/Supabase connection or PostgreSQL-specific concurrent multi-connection behavior. The atomic courier-claim race was simulated with two TestClient requests against local SQLite. `psycopg` was not installed in the test environment.
- Cloudinary upload, network failure cleanup and image transformation. `cloudinary` was not installed in the test environment.
- Render deploy, domain/TLS, free-tier behavior or live request routing.
- Real Android/Termux installation and visual browser tests.
- Full penetration test, load test, browser accessibility audit or payment verification.

## Known product/security limits retained

- IP/login/order rate limit is in-memory and per worker; restart resets it. Forwarded headers are trusted by the supplied Uvicorn command. This is only safe if the provider edge overwrites client-supplied forwarded headers and no direct path bypasses the edge; verify before relying on IP limits.
- Single shared admin key; no named accounts, RBAC, 2FA or audit log.
- One product per order; no cart, per-size/per-colour stock, tracking page, SMS, payment gateway or return workflow.
- No pagination, export, print, order editing or analytics report.
- No courier webhook/polling after initial consignment creation.
- Ad-hoc additive migrations remain; Alembic is not introduced.
- Image upload has no EXIF removal, dimension cap, optimization or orphan cleanup.
- Pixel/GA4 consent banner and policy review remain outstanding.
- Some old CMS settings and substantial legacy CSS are still unused.
- Existing imported demo product photos may still point to third-party Sarrah BD URLs; replace them with authorized RIHAM assets.

## Deployment gate

Do not take live customer orders until you have a backed-up persistent PostgreSQL service, Cloudinary (or engineered persistent image storage), approved images/prices/policies, verified domain and cookie settings, a restored backup rehearsal, and a successful live Steadfast merchant test. Render Free filesystem is ephemeral; Render Free PostgreSQL expires after 30 days. Review current provider terms before choosing a plan.
