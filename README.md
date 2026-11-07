# RIHAM Store v8.4 — hardened demo build

Bengali mobile-first modest-fashion storefront with product landing pages, Cash-on-Delivery orders, a single-admin panel, stock handling and optional Steadfast/Cloudinary integrations.

## What's changed in v8.4

- Safe one-time local demo seeding; production never seeds demo products.
- Production refuses to start with missing/SQLite `DATABASE_URL`, insecure cookies, weak secrets or missing HTTPS `PUBLIC_SITE_URL`.
- Local uploads are blocked in production; Cloudinary is required for new production uploads.
- Stock deduction uses conditional database updates; failed reservations roll back.
- Order receipts exposed to customers no longer include phone, address or internal fraud-review fields.
- Bangladesh phone numbers accept Bengali/Arabic-Indic digits and validate real mobile prefixes (`013`–`019`).
- Order timestamps serialize with explicit UTC `Z`; invoice date uses Dhaka local date.
- Status transitions are constrained and cancellation/reopen stock changes are transaction-safe against repeated status updates.
- Steadfast nested response parsing and an atomic database claim for each courier submission; ambiguous outcomes require manual Merchant Panel verification before retry.
- Health endpoint checks the database, static assets revalidate after deploy, and admin has improved order/session handling.
- SEO descriptions are shortened for metadata, images use lazy loading below the first image, and COD submission is tracked as a lead rather than a completed purchase.

## Run locally on Android (Termux)

Assumption: Termux is installed from a supported source and Python is available from its package repository. The `.python-version` file targets Python 3.12.16 for the hosted build; it does not install that Python version inside Termux.

**Termux compatibility warning:** This project uses Pydantic v2, which depends on the compiled `pydantic-core` package. The exact Android/Termux installation path was not tested. If `pip install` fails while building/downloading `pydantic-core`, do not force an untrusted or archived wheel and do not downgrade FastAPI/Pydantic blindly; run the project in Colab/Linux or use a currently supported Termux package source with a compatible wheel.

```sh
pkg update && pkg upgrade -y
pkg install python git unzip -y
unzip RIHAM_v8_4_Hardened.zip
cd riham-store
cp .env.example .env
nano .env
python -m venv .venv
. .venv/bin/activate
python -m pip install --upgrade pip
pip install -r requirements.txt
uvicorn app.main:app --host 0.0.0.0 --port 8000
```

Open `http://127.0.0.1:8000` for the store and `http://127.0.0.1:8000/admin` for Admin. In local development, an empty `ADMIN_ACCESS_KEY` causes a temporary key to be printed in the terminal; set your own before sharing access. SQLite and local `uploads/` are for local demo only.

To run tests:

```sh
pip install -r requirements-dev.txt
pytest -q tests
```

## Hosted Python version

`.python-version` pins the hosted build to Python 3.12.16, the latest Python 3.12 security release available when this build was prepared. The local validation environment used Python 3.13.5, so Python 3.12.16 deployment compatibility is not claimed as directly tested. Production-only integrations are pinned to `psycopg[binary]==3.3.8` and `cloudinary==1.47.0`; their install and live connections were not exercised here.

## Production requirements

Do not deploy this as a live store with local SQLite or Render's ephemeral filesystem. Render Free web services lose local files on restart/redeploy, and Render Free Postgres expires after 30 days. Use a database plan/provider with a persistent lifecycle and backups, and configure Cloudinary (or a separately engineered persistent object store) for images. See Render's current docs: https://render.com/docs/free and https://render.com/docs/disks. The app refuses production startup if `DATABASE_URL` is empty/SQLite.

Set these environment variables in the hosting provider:

- `APP_ENV=production`
- `SEED_DEMO_DATA=false`
- `DATABASE_URL` = PostgreSQL connection string; this build uses psycopg v3 (`postgresql+psycopg://...`).
- `PUBLIC_SITE_URL=https://your-real-domain`
- `COOKIE_SECURE=true`
- Strong unique `ADMIN_ACCESS_KEY` (at least 12 characters) and `SESSION_SECRET` (at least 32 random characters).
- `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` before production image uploads.
- Steadfast credentials only after confirming the current API base URL and response contract in your Merchant Panel/docs.

Generate a secret with `python -c "import secrets; print(secrets.token_urlsafe(48))"`. Do not put secrets in source code, GitHub commits, screenshots or chat messages.

## Operational warnings

- The storefront still sells one product per order; no multi-product cart or variant-level stock exists.
- Order/login rate-limit counters are in process memory and reset when the service restarts. Multiple workers do not share counters.
- The Uvicorn commands trust forwarded headers from all peers (`--forwarded-allow-ips='*'`). This is only safe when the hosting edge proxy overwrites incoming forwarded headers and the app cannot be reached around that proxy. Verify this assumption with the actual hosting provider before treating IP rate limiting as a security boundary.
- Admin still uses one shared access key; there are no named operator accounts, roles, 2FA or audit log.
- Courier status does not automatically synchronize after consignment creation; there is no webhook/polling integration.
- Image upload validation checks file signatures and file size, but EXIF stripping, image dimension limits, image optimization and orphan cleanup are not implemented.
- Return/exchange workflow, payment gateway, SMS OTP, customer order tracking, order exports and order pagination are not implemented.
- Demo images are remote references from Sarrah BD and may have watermark/copyright restrictions. Replace them with client-owned/approved product images before launch.

See `HANDOFF.md`, `HANDOFF_BN.md`, `CHANGES_BN.md` and `TEST_REPORT_V8_4_BN.md` before deployment.
