# RIHAM v8.1 Project Handoff

এই ZIP-এ RIHAM-এর V7 lookbook storefront, একই পাতার order form, Admin dashboard, order protection এবং delivery calculation আছে। Admin-এর internal product/category mapping রাখা হয়েছে; customer-facing Homepage-এ category option নেই। v7-এ public homepage-কে বড় বড় vertical collection photo এবং এক পাতার order form দিয়ে নতুনভাবে সাজানো হয়েছে।

## V7-এ যা বদলেছে
- ছয়টি demo product, BDT demo price, stock, sizes/colors এবং ১৭টি unique reference product photo URL যোগ করা হয়েছে।
- Homepage-এ ১৭টি ছবি বড় vertical frame হিসেবে একটির পর একটি দেখা যায়; ছোট product grid বা customer-facing category tile নেই।
- Admin-এর internal category ও product management রাখা হয়েছে; customer-facing storefront-এ category menu/section নেই।
- Delivery logic ঠিক করা হয়েছে: কার্টে শুধু সম্পূর্ণ বোরকা + হিজাব + নিকাব ফুল সেট থাকলে delivery free। অন্য যেকোনো পণ্য মিশলে area-based charge যোগ হবে।
- Non-full-set category-তে Admin-এর free-delivery checkbox disabled; backend-ও ভুল free-delivery flag reject করে।
- বাংলা heading/body font-size, product card, category card এবং mobile spacing কমিয়ে layout গুছানো হয়েছে।
- Remote image load না হলে placeholder দেখানোর fallback যোগ করা হয়েছে।

## Reference photo সতর্কতা
১৭টি ছবির URL Sarrah BD reference website থেকে নেওয়া হয়েছে। ছবিতে Sarrah branding/watermark থাকতে পারে। এই ZIP-এ ছবিগুলো binary/local file হিসেবে ZIP-এ রাখা হয়নি; website-এ source URL থেকে load হবে। Source site hotlink বন্ধ করলে বা URL বদলালে ছবি নাও আসতে পারে। এগুলো শুধু demo; production-এর আগে client-owned বা লিখিতভাবে approved image Admin থেকে upload করে replace করুন।

## Demo catalogue
সব নাম, দাম, স্টক, রং ও সাইজ placeholder data। Client-এর actual catalogue অনুযায়ী Admin থেকে edit করতে হবে। Fresh database-এ ছয়টি demo product seed হবে। আগে থেকেই product থাকা database-এ existing products overwrite করা হবে না।

## V7 delivery test result
- শুধু সম্পূর্ণ ফুল সেট: ৳০ delivery.
- ফুল সেট + আলাদা হিজাব: Dhaka/outside delivery fee.
- শুধু হিজাব/নিকাব বা hijab+niqab combo: Dhaka/outside delivery fee.

Local test-এ default Dhaka delivery ৳৫০ এবং outside Dhaka ৳১০০ ব্যবহার করা হয়েছে। Admin → Website Settings থেকে rate বদলানো যাবে।

## পূর্ববর্তী সংস্করণের features
- New Arrival banner, চারটি benefit card, optional Trust Strip এবং customer review gallery.
- About, Contact, Delivery, Return/Exchange এবং Privacy pages.
- Social links, SEO metadata, structured data, robots ও sitemap.
- GA4 / Meta Pixel optional configuration.
- Product-level Size Guide, selected size/color/quantity সহ WhatsApp order message.
- Admin থেকে content ও image edit/upload.

## Test করার ধাপ
1. ZIP extract করে `START_HERE_BN.md` অনুসরণ করুন।
2. Homepage, category cards, product gallery, cart ও checkout পরীক্ষা করুন।
3. Admin → Products থেকে photo, price, stock, size/color ও free delivery edit পরীক্ষা করুন।
- Admin-এর internal category ও product management রাখা হয়েছে; customer-facing storefront-এ category menu/section নেই।
5. Dhaka এবং outside delivery দুটো area-তেই full-set-only ও mixed-cart order পরীক্ষা করুন।

## Production সতর্কতা
- Sarrah BD-এর logo/name, phone, social account, customer count, rating বা review photo RIHAM-এর পরিচয় হিসেবে ব্যবহার করবেন না।
- Product photo, price, measurement, stock, return/exchange policy ও business contact ক্লায়েন্টের কাছ থেকে confirm করুন।
- Production-এ strong `ADMIN_ACCESS_KEY`, 32+ character random `SESSION_SECRET`, HTTPS/secure cookie, persistent database/image storage ও backups configure করুন।
- Steadfast live API, production Supabase/Cloudinary ও courier workflow এই local test-এ real credentials দিয়ে যাচাই করা হয়নি।
- Fake-order protection heuristic-based; SMS OTP বা শতভাগ প্রতিরোধের নিশ্চয়তা নেই।

**এটি testable demo foundation; production security audit বা live business launch-এর চূড়ান্ত অনুমোদন নয়।**


## V8.1 — পণ্যভিত্তিক Facebook Ad landing page
- প্রতিটি active product-এর জন্য `/{slug}` public URL তৈরি হয়। Admin থেকে product add/edit করলেই URL তৈরি/আপডেট হয়।
- Landing page-এ ওই product-এর সর্বোচ্চ ৬টি ছবি, price/discount, description, size guide, stock note এবং fixed-product COD form থাকে; product-choice ধাপ নেই।
- Homepage-এর all-products lookbook + all-products order form আগের মতোই থাকে।
- `/api/products/by-slug/{slug}` API যোগ হয়েছে। পুরোনো `/product/{id}` URL active product-এর নতুন slug URL-এ 301 redirect করে।
- ASCII slug generation, reserved slug rejection, duplicate check এবং startup SQLite/PostgreSQL-compatible slug repair migration যোগ হয়েছে। Existing valid ASCII slugs অক্ষত থাকে।
- Slug history সংরক্ষণ করা হয়নি; তাই Admin slug change-এর আগে সতর্ক করে। চলমান বিজ্ঞাপনে নতুন URL বসাতে হবে।
- Product SEO/OG/Twitter/JSON-LD server HTML-এ inject হয়। Homepage OG image প্রথম active product image থেকে আসে।
- `PUBLIC_SITE_URL` product/home metadata, canonical, sitemap ও robots-এর base URL; সেটি না থাকলে `request.base_url` ব্যবহৃত হয়।
- Product landing page এবং home একই mode-aware `app.js` ও `/static/pixel.js` ব্যবহার করে। Meta events: PageView, ViewContent, InitiateCheckout, Purchase.
- Store owner-এর বাংলা নির্দেশনা: `HOW_TO_USE_V8_1_BN.md`; পরীক্ষার ফল/সীমাবদ্ধতা: `TEST_REPORT_BN.md`।

## V8.1 known verification limits
- SQLite + FastAPI TestClient checks ran. Full `pip install -r requirements.txt` could not complete because package index DNS/network was unavailable in this environment.
- Chromium exists, but the execution environment blocked local HTTP navigation with `ERR_BLOCKED_BY_ADMINISTRATOR`; real 390px/desktop browser interaction, visual rendering, JS console and Pixel queue remain unverified here.
- Live Facebook crawler, Render, Steadfast and PostgreSQL were not available for live verification.

## V8.2 আপডেট
- হোমপেজে সম্মিলিত অর্ডার ফর্ম নেই; প্রতিটি পণ্যের অর্ডার বাটন সরাসরি নিজস্ব slug landing page খোলে।
- প্রতিটি product landing page-এ শুধু সংশ্লিষ্ট পণ্যের অর্ডার ফর্ম আছে; COD backend অপরিবর্তিত।
- হেডার/ফুটারের ব্র্যান্ডিং “RIHAM STORE”; বড় একক R badge বাদ। Footer-এ বাংলা tagline ও নেভিগেশন আছে।
