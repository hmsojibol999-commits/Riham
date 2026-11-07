# RIHAM Master Demo v8.1 — শুরু করার সহজ নির্দেশনা

## ১) লোকাল ডেমো চালানো
1. ZIP Extract করুন।
2. Extract করা `riham-store` ফোল্ডারটি খুলুন।
3. `.env.example` কপি করে `.env` নামে রাখুন।
4. নিজের `ADMIN_ACCESS_KEY` ও `SESSION_SECRET` দিন। Secret কাউকে পাঠাবেন না এবং Frontend কোডে লিখবেন না।
5. Terminal-এ চালান: `pip install -r requirements.txt`
6. তারপর চালান: `uvicorn app.main:app --reload`
7. Store: `http://127.0.0.1:8000`
8. Admin: `http://127.0.0.1:8000/admin`

## ২) Customer Website-এ পরীক্ষা
- Homepage-এর একটির পর একটি বড় full-height collection image scroll করে দেখুন; public category menu/section নেই।
- `/about`, `/contact`, `/policy/delivery`, `/policy/return`, `/policy/privacy` পেজ খুলে দেখুন।
- Homepage-এর Order Form-এ Full Set / Hijab + Niqab, size, quantity, নাম, phone, address, delivery area, COD ও live total পরীক্ষা করুন।
- Admin → Products-এ product image, price, stock, size ও free-delivery edit করে Home Collection update হচ্ছে কি না দেখুন।
- শুধু সম্পূর্ণ বোরকা + হিজাব + নিকাব ফুল সেটে Free Delivery; কার্টে অন্য পণ্য যোগ হলে Admin Settings-এর ঢাকা/বাইরের চার্জ প্রযোজ্য হবে।

## ৩) Admin-এ পণ্য যোগ
- `পণ্য পরিচালনা` → `নতুন পণ্য`।
- নাম, ক্যাটাগরি, স্টক, মূল দাম, ডিসকাউন্টের পর দাম ও বিস্তারিত লিখুন।
- চাইলে সাইজ, রং এবং পণ্যের সঠিক Size Guide দিন।
- সর্বোচ্চ ৬টি ছবি: ১ সামনের দিক, ২ পেছনের দিক, ৩ পাশের দিক, ৪ কাপড়/কাজের ক্লোজআপ, ৫ রং/ডিটেইল, ৬ অন্য ছবি। Image slot-এর ← / → বাটন দিয়ে ছবির ক্রমও বদলাতে পারবেন।
- category `ফুল সেট` হলে Free Delivery toggle চালু করা যাবে। শুধু হিজাব, শুধু নিকাব, বা হিজাব + নিকাব কম্বোতে toggle বন্ধ থাকবে।

## ৪) Admin → Website Settings
- Homepage: Store Name, intro title/subtitle ও WhatsApp number. V7 Collection image Product → Edit → Images থেকে বদলান; legacy Hero image V7 gallery-তে ব্যবহৃত হয় না।
- Trust & Tagline: customer count, rating, review count শুধু সত্য/যাচাই করা হলে দিন। ফাঁকা থাকলে এগুলো ওয়েবসাইটে দেখাবে না।
- New Arrival: নতুন কালেকশনের নাম, লেখা, ছবি দিয়ে Banner চালু করুন।
- চারটি Feature card-এর লেখা বদলান।
- Customer Review: কাস্টমারের বাস্তব ছবি সর্বোচ্চ ৫টি আপলোড করুন; প্রকাশের অনুমতি নিশ্চিত করুন।
- About/Contact: স্টোর পরিচিতি, ফোন, ইমেইল, ঠিকানা, Facebook ও Instagram দিন।
- Policy: Return/Exchange-এর নিয়ম ক্লায়েন্টের কাছ থেকে নিশ্চিত করে লিখুন; অনুমান করে কোনো শর্ত লিখবেন না।
- SEO: Page Title, Meta Description, Keywords দিন। GA4 ও Meta Pixel ID ঐচ্ছিক; না থাকলে ফাঁকা রাখুন।

## ৫) ডেলিভারি চার্জ
- কার্টে শুধু সম্পূর্ণ ফুল সেট থাকলে ডেলিভারি ৳০।
- শুধু হিজাব, শুধু নিকাব, হিজাব + নিকাব, বা ফুল সেটের সঙ্গে অন্য পণ্য মেশানো থাকলে ঢাকা/বাইরের চার্জ যোগ হবে।
- ডিফল্ট: ঢাকার ভিতরে ৳৫০, ঢাকার বাইরে ৳১০০। Admin → Website Settings থেকে বদলানো যাবে।
- Backend নিজে charge হিসাব করে; browser থেকে পাঠানো delivery fee বিশ্বাস করে না।

## ৬) ভুয়া অর্ডার প্রতিরোধ
Hidden bot-trap, খুব দ্রুত ফর্ম submit আটকানো, IP/phone rate limit এবং একই ফোন থেকে একই পণ্যের duplicate order আটকানোর ব্যবস্থা আছে। একই নম্বর থেকে কাছাকাছি সময়ে আরেকটি অর্ডার এলে Admin-এ সতর্কতা দেখাবে। এটি SMS OTP নয় এবং শতভাগ ভুয়া অর্ডার আটকানোর নিশ্চয়তা দেয় না। Admin ফোনে কাস্টমার নিশ্চিত করার পরই Steadfast-এ পাঠাবেন।

## ৭) Database, ছবি ও API
- Local Demo-তে SQLite চলে; hosted ব্যবহারে `DATABASE_URL` দিয়ে Supabase PostgreSQL ব্যবহার করা যাবে।
- ছবি স্থায়ী রাখতে Cloudinary credentials Environment Variables-এ দিন। Local uploads hosting restart/deploy-এ হারাতে পারে।
- Steadfast API Key ও Secret শুধু Environment Variables-এ দিন; `.env` GitHub-এ commit করবেন না।
- `PUBLIC_SITE_URL` দিলে sitemap/robots-এ নিজের public domain ব্যবহার হবে। না দিলে request host ব্যবহার হবে।

## ৮) Production চালুর আগে
HTTPS/secure cookie, Supabase connection, Cloudinary persistence, database backup, strong secrets, real policy text, actual customer reviews, actual product data, GA4/Pixel consent/privacy wording এবং Steadfast live test যাচাই করুন। Demo দিয়ে live customer orders নেওয়া শুরু করবেন না যতক্ষণ এসব পরীক্ষা সম্পন্ন না হয়।

**Sample product data ও sample images শুধু Demo-এর জন্য। ক্লায়েন্টের প্রকৃত পণ্যের ছবি, মূল্য, size/measurements এবং policies Admin থেকে বসাবেন।**


## V7 Demo সতর্কতা
- Homepage-এর ১৭টি unique collection photo reference website-এর public image URL হিসেবে যোগ করা হয়েছে; এগুলো ZIP-এর ভিতরে local image file হিসেবে download করা হয়নি। ছবি source site-এ থাকলে load হবে।
- ছবিতে source watermark থাকলে সেটি থাকবে; ZIP-এর ভেতরে watermark সরানো বা RIHAM watermark বসানো হয়নি। live করার আগে অনুমোদিত clean RIHAM image Admin থেকে upload করুন।
- শুরুতে দেখানো দাম/স্টক/সাইজ demo; client-এর কাছ থেকে confirm করে বদলান।
- Delivery test: শুধু ফুল সেট = free; ফুল সেট + hijab/niqab = Dhaka/outside fee; শুধু hijab/niqab = Dhaka/outside fee।


## ৯) Facebook বিজ্ঞাপনের জন্য পণ্যের আলাদা লিংক (V8.1)
- নতুন পণ্য Save করলে তার আলাদা পেজ নিজে তৈরি হবে।
- পণ্য তালিকা থেকে সম্পূর্ণ URL-এর পাশে `কপি` চাপুন; বিজ্ঞাপনের Website URL/Destination-এ সেটি দিন।
- পেজে শুধু ওই পণ্যের ছবি, বিবরণ ও অর্ডার ফর্ম থাকবে।
- slug পরিবর্তন করলে পুরোনো বিজ্ঞাপন লিংক আর কাজ করবে না; বিজ্ঞাপনে নতুন লিংক বসান।
- বিস্তারিত: `HOW_TO_USE_V8_1_BN.md`।
