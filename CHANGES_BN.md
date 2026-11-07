# RIHAM V7 — পরিবর্তনের তালিকা

1. Sarrah BD reference link থেকে আসল product-view image URL ব্যবহার করা হয়েছে; AI-generated replacement image ব্যবহার করা হয়নি। ছবিগুলো reference/demo asset এবং watermark-সহ আছে।
2. ছয়টি demo product, demo price, stock, size/color option এবং front/side/back/close-up image mapping যোগ করা হয়েছে।
3. বোরকা, হিজাব, নিকাব, ফুল সেট ও হিজাব+নিকাব category card-এ demo image যোগ হয়েছে।
4. Delivery bug ঠিক: cart-এর সব item free-delivery full set না হলে Dhaka/outside charge যোগ হবে। শুধু ফুল সেট নিলে charge ০।
5. Product category বদলালে Admin-এর free-delivery checkbox স্বয়ংক্রিয়ভাবে category অনুযায়ী বদলায়।
6. Admin থেকে category name ও description edit করা যায়; category rename করলে সংশ্লিষ্ট product category-ও update হয়।
7. বাংলা typography, mobile card sizing, spacing ও category presentation compact করা হয়েছে যাতে লেখা/কার্ড overlap না করে।
8. V6 handoff ও README-তে reference image, demo price এবং production replacement note যোগ করা হয়েছে।

## V6 demo photo source (ঐতিহাসিক তালিকা)
- https://www.sarrahbd.com/images/safa-set/safa-1.jpeg
- https://www.sarrahbd.com/images/safa-set/safa-2.jpeg
- https://www.sarrahbd.com/images/safa-set/safa-3.jpeg
- https://www.sarrahbd.com/images/sarah1/sr1.jpg
- https://www.sarrahbd.com/images/sarah1/sr2.jpg
- https://www.sarrahbd.com/images/muslima-set/ms1.jpg
- https://www.sarrahbd.com/images/muslima-set/ms2.jpg

**Production note:** client-owned or explicitly approved images must replace every reference image and all demo prices/details must be confirmed before the public launch.


## V7
- Storefront-এ Category navigation/tiles সরানো হয়েছে; Admin-এর internal category ও product management অক্ষত।
- Collection এখন একটির পর একটি বড় portrait image lookbook; প্রতিটি frame screen-height presentation ব্যবহার করে।
- Order form homepage-এর ভেতরেই আছে: product, size, quantity, name, phone, full address, delivery area, COD, summary ও confirm।
- Gallery product-এর Images list থেকে আসে; Admin থেকে image upload, remove এবং ← / → button দিয়ে reorder করা যায়।
- SarrahBD-এর verified image URLs ব্যবহার করা হয়েছে; source watermark অক্ষত আছে এবং ছবিগুলো remote load হয়।

## V8 (client feedback)
- BUG FIX: Admin থেকে নতুন পণ্য যোগ করলে আগে শুধু lookbook-এ ছবি আসত, order form-এ আসত না (ফর্মে শুধু ১টা ফুল সেট + ১টা কম্বো দেখাত)। এখন active ও স্টকে থাকা সব পণ্য order form-এ আসে।
- BUG FIX: একাধিক রং থাকলে customer রং বাছতে পারত না (সবসময় প্রথম রং যেত)। এখন ২+ রং থাকলে রং বাছাই দেখায়।
- BUG FIX: সাইজ না থাকা পণ্যে ভুয়া ডিফল্ট সাইজ দেখাত; এখন সাইজ ধাপটি লুকায়।
- BUG FIX: +8801XXXXXXXXX ফরম্যাটের নম্বর ফ্রন্টএন্ডে reject হতো; এখন backend-এর মতোই গ্রহণ করে।
- BUG FIX: validation error হলে "[object Object]" দেখাত (admin ও storefront); এখন পরিষ্কার বাংলা বার্তা।
- BUG FIX: product পেজের "কার্টে যোগ করুন" v7-এ কাজ করত না; এখন order form-এ ওই পণ্য বাছাই করে নিয়ে যায়।
- BUG FIX: PostgreSQL পুরোনো DB upgrade-এ boolean DEFAULT 0 migration crash করতে পারত; DEFAULT FALSE করা হয়েছে।
- Order form ছোট (compact) করা হয়েছে (ফর্ম, বাটন, কার্ড, ইনপুটের মাপ কমানো)।
- নতুন: গ্রাহক রিভিউ slider (swipe, তীর, dots, autoplay)। Admin → সেটিংস → গ্রাহকের রিভিউ ছবি (সর্বোচ্চ ১০টি)।
- নতুন: Meta Pixel + GA4 loader (app/static/pixel.js)। Admin-এ Pixel ID বসালেই চালু। Events: PageView, ViewContent, InitiateCheckout, Purchase (মোট টাকা, BDT)। ID format backend-এও যাচাই হয়।


## V8.1 — পণ্যভিত্তিক Facebook Ad পেজ
- Admin থেকে পণ্য যোগ করলে স্বয়ংক্রিয়ভাবে `/{slug}` লিংক তৈরি হয়; লিংক ASCII, সম্পাদনাযোগ্য এবং duplicate/reserved slug server-side-এ প্রত্যাখ্যাত হয়। বাংলা-only নামের জন্য `product-<id>` fallback আছে।
- প্রতিটি active পণ্যের জন্য আলাদা landing page যোগ হয়েছে—শুধু সেই পণ্যের সর্বোচ্চ ৬টি ছবি, বিবরণ, দাম/ছাড়, সাইজ গাইড, স্টক অবস্থা এবং নির্দিষ্ট পণ্যের COD অর্ডার ফর্ম দেখা যায়। Homepage-এর আগের all-products lookbook ও order form রাখা হয়েছে।
- পুরোনো Unicode/reserved slug startup migration-এ ঠিক হয়; valid ASCII slug অপরিবর্তিত থাকে। পুরোনো `/product/{id}` route active পণ্যের নতুন slug URL-এ 301 redirect করে।
- Product landing page-এর title, description, Open Graph, Twitter Card, canonical ও Product JSON-LD server-side HTML-এ তৈরি হয়। Homepage OG image প্রথম active product-এর প্রথম ছবি থেকে আসে।
- Admin পণ্য তালিকায় পূর্ণ পেজ লিংক, কপি ও পেজ দেখার সুবিধা; slug পরিবর্তনের আগে চলমান বিজ্ঞাপনের পুরোনো URL বন্ধ হয়ে যাওয়ার সতর্কতা যোগ হয়েছে।
- WhatsApp message-এ পণ্যের নাম, কার্যকর দাম ও page URL যুক্ত হয়। Landing page-এ product-specific Pixel ViewContent, InitiateCheckout ও Purchase tracking যুক্ত হয়েছে; customer-এর ব্যক্তিগত তথ্য Pixel-এ পাঠানো হয় না।
- `PUBLIC_SITE_URL` দেওয়া থাকলে SEO, canonical, sitemap ও robots-এ সেটি ব্যবহৃত হয়; না থাকলে request host ব্যবহৃত হয়। Render environment template-এ ভ্যারিয়েবলটি যোগ হয়েছে।
- বাংলা owner guide এবং test report যোগ হয়েছে: `HOW_TO_USE_V8_1_BN.md`, `TEST_REPORT_BN.md`।
- কোনো নতুন runtime dependency যোগ হয়নি। Chromium, বাস্তব Facebook crawler, Render, Steadfast live API ও PostgreSQL verification environment সীমাবদ্ধতায় সম্পন্ন হয়নি—বিস্তারিত test report-এ।
