# RIHAM Store v8.4 — Android/Termux থেকে চালু করুন

## ১. Local demo setup

```sh
pkg update && pkg upgrade -y
pkg install python unzip -y
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

Store: `http://127.0.0.1:8000`

Admin: `http://127.0.0.1:8000/admin`

Local `.env`-এ `APP_ENV=development`, `DATABASE_URL=sqlite:///./riham_demo.db`, `COOKIE_SECURE=false` রাখুন। `ADMIN_ACCESS_KEY` ফাঁকা থাকলে app terminal-এ temporary key print করবে। স্থায়ী local কাজের জন্য নিজের key বসান। `.env` GitHub-এ commit করবেন না।

**Termux compatibility note:** এই project Pydantic v2 ব্যবহার করে; এর `pydantic-core` compiled Rust extension। Android/Termux-এ install flow এখানে পরীক্ষা করা হয়নি। `pip install`-এ `pydantic-core` build/download error হলে অচেনা বা archived wheel জোর করে install করবেন না, FastAPI/Pydantic downgrade-ও করবেন না। Colab/Linux-এ চালান অথবা compatible wheel-সহ বর্তমানে supported Termux package source ব্যবহার করুন। `.python-version` hosted build-এর জন্য Python 3.12.16 নির্ধারণ করে; Termux-এর Python version বদলায় না।

## ২. কী পরীক্ষা করবেন

- Homepage থেকে product landing page খুলুন; product stock শেষ হলে order বন্ধ থাকে।
- বাংলা mobile number, +880 format, note এবং Dhaka/outside delivery পরীক্ষা করুন। Default delivery selection এখন outside—ভুল করে কম delivery charge নেওয়া ঠেকাতে।
- Admin-এ লগইন করে order confirm করুন; তারপর চাইলে Steadfast পাঠান।
- Steadfast result timeout/unclear হলে Merchant Panel-এ invoice খুঁজে না দেখে Retry খুলবেন না। Retry button চাপার আগে confirmation dialog আসবে।
- Order cancel করলে stock একবার ফেরত আসে; shipped/delivered বা courier-submitted order সরাসরি cancel করা যায় না।

## ৩. Production-এর আগে বাধ্যতামূলক কাজ

- Production-এ SQLite ব্যবহার করবেন না। Backup-সহ persistent PostgreSQL URL দিন।
- Render Free web-service filesystem স্থায়ী নয়; Render Free Postgres-ও ৩০ দিন পরে expire করে। Local SQLite/uploads-কে live order বা photo storage ভাববেন না।
- `APP_ENV=production`, `SEED_DEMO_DATA=false`, `COOKIE_SECURE=true`, শক্ত `ADMIN_ACCESS_KEY`, ৩২+ অক্ষরের random `SESSION_SECRET`, HTTPS `PUBLIC_SITE_URL` দিন।
- Production image upload করতে Cloudinary credentials দিন। না থাকলে API upload বন্ধ থাকবে, local disk-এ ছবি রাখবে না।
- Sarrah BD demo ছবি, demo price, stock, policy, review এবং contact details বদলে client-এর অনুমোদিত তথ্য দিন।
- Steadfast API base URL ও credentials Merchant Panel-এর বর্তমান official documentation থেকে verify করে live order ছাড়া অন্যভাবে পরীক্ষা করবেন না।
- Database backup/restore test করুন। Demo DB backup ছাড়া production-এ migrate করবেন না।

## ৪. Test চালানো

```sh
pip install -r requirements-dev.txt
pytest -q tests
```

এটি local SQLite/TestClient regression test। Live Postgres, Render, Cloudinary ও Steadfast যাচাই করে না। বিস্তারিত `TEST_REPORT_V8_4_BN.md` এবং `HANDOFF_BN.md` পড়ুন।
