# RIHAM Store v8.4 — বাংলা Handoff

এটি v8.3-এর ওপর targeted hardening update; পুরো project rewrite নয়। Storefront এখনও এক order-এ এক product, Cash on Delivery এবং single shared Admin key ব্যবহার করে।

## প্রধান fix

- **Steadfast:** response-এর nested `consignment` থেকে ID/tracking code পড়া হয়; numeric `status: 200` গ্রহণ করা হয়। ২৫০ অক্ষরের বেশি ঠিকানা silent truncate না করে reject হয়। Customer note courier payload-এ যায়। Request পাঠানোর আগে conditional SQL update দিয়ে atomic `submitting` claim DB-তে commit হয়; দুই Admin একসঙ্গে Send চাপলেও একজনই claim পায়। Timeout বা tracking ID অনুপস্থিত হলে status `unknown`; Merchant Panel-এ invoice না থাকার manual confirmation ছাড়া retry করা যায় না।
- **Production storage:** `APP_ENV=production` হলে SQLite/খালি `DATABASE_URL` দিয়ে app startup হবে না। Production upload-এর জন্য Cloudinary বাধ্যতামূলক; Cloudinary না থাকলে local disk-এ ছবি save হবে না। Production demo seed বন্ধ।
- **Demo seed/migration:** Local database সম্পূর্ণ খালি হলেই demo seed হয়; existing product/gallery/size/theme overwrite হয় না। Startup migration আর theme white করে না। পুরোনো DB-তে missing courier fields add হয়।
- **Stock:** order create করার সময় conditional SQL stock decrement হয়; insufficient stock হলে transaction rollback। Cancel/reopen status transition compare-and-set SQL update ব্যবহার করে, যাতে একই order একাধিক Admin session থেকে cancel হলেও stock দ্বিতীয়বার restore না হয়।
- **Phone/input:** বাংলা ও Arabic-Indic digit normalize হয়; `013`–`019` prefix ছাড়া নম্বর reject। Name/address trim হয়। Duplicate error-এ আগের invoice expose হয় না।
- **Privacy:** customer receipt-এ phone/address/fraud flag/fraud reason নেই। Admin order API-তে internal fields আছে।
- **Time/health:** API timestamp-এ UTC `Z`; invoice date Asia/Dhaka; health endpoint DB `SELECT 1` চালায়।
- **Storefront/Admin:** hidden category-এর product customer API, direct landing URL ও order flow থেকে বন্ধ; নতুন order notification ID দিয়ে detect; failed status update-এ Admin list refresh; expired session login-এ ফেরে; courier retry-এর আগে confirmation লাগে।
- **SEO/performance:** meta description ১৬০ অক্ষরে সীমিত, static asset deploy-এর পর revalidate, প্রথম ছবির পরের ছবি lazy load, COD order-কে completed Purchase না দেখিয়ে Lead event পাঠায়।

## Test ও সীমাবদ্ধতা

Local SQLite + FastAPI TestClient regression tests এবং Node syntax checks চালানো হয়েছে। ফল `TEST_REPORT_V8_4_BN.md`-এ। Live Steadfast, PostgreSQL, Cloudinary, Render ও real Android/Termux test করা হয়নি। Concurrent courier claim-এর দুই-request race local SQLite-এ simulate করা হয়েছে; PostgreSQL multi-connection stress test হয়নি।

## এখনো বাকি

- In-memory rate-limit restart/multiple-worker-এ shared নয়; forwarded header trust provider proxy configuration-এর ওপর নির্ভরশীল।
- Shared Admin key; named user, role, 2FA, audit log নেই।
- Cart, variant-wise stock, customer tracking page, SMS, online payment, returns workflow নেই।
- Order pagination/search/export/edit নেই। Courier webhook/status polling নেই।
- Alembic migration নেই; ad-hoc additive migration আছে।
- EXIF strip, image dimensions limit, optimization ও orphan image cleanup নেই।
- Pixel/GA4 consent banner/privacy-policy update দরকার। কিছু legacy CMS setting ও unused CSS রয়ে গেছে।
- Imported demo image এখনও third-party URL হতে পারে; অনুমোদিত RIHAM image দিয়ে replace করতে হবে।

## Live launch gate

Backup-সহ persistent PostgreSQL, Cloudinary, approved image/price/return policy, HTTPS domain, strong secrets, backup restore rehearsal এবং real Merchant Panel-এর Steadfast smoke test ছাড়া live customer order নেবেন না। Render Free filesystem ephemeral; Render Free PostgreSQL ৩০ দিন পরে expire করে—বর্তমান provider terms দেখে স্থায়ী database পরিকল্পনা করুন।
