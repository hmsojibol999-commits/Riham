# RIHAM v7 Project Handoff

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
