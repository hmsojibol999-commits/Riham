# RIHAM STORE v8.3 — স্টোর পরিচালনার সহজ নির্দেশিকা

## গ্রাহক কীভাবে পণ্য দেখবেন ও অর্ডার করবেন
- Homepage-এ প্রতিটি active product একবার করে compact card হিসেবে দেখা যায়। Card-এ প্রথম ছবি, নাম ও দাম থাকবে।
- “অর্ডার করুন” চাপলে সরাসরি সেই product-এর নিজের landing page খুলবে। Homepage-এ কোনো সম্মিলিত order form নেই।
- Product page-এ একবারে একটি ছবি দেখা যায়; একাধিক ছবি থাকলে প্রায় ২.৮ সেকেন্ড পরপর স্বয়ংক্রিয়ভাবে slide হবে। গ্রাহক arrow, নিচের dot অথবা মোবাইলে swipe করেও ছবি বদলাতে পারবেন।
- পণ্যের তথ্য পড়ার পর নিচে স্ক্রল করলে সেই product-এর COD order form পাওয়া যাবে। অন্য product-এর form সেখানে আসবে না।

## Admin থেকে নতুন পণ্য যোগ
1. Admin → Products → নতুন পণ্য খুলুন।
2. পণ্যের নাম, দাম, stock, category, size/color এবং description দিন।
3. সর্বোচ্চ ৬টি ছবি upload করুন; যে ছবিটি Homepage-এ card-এর cover হিসেবে দেখাতে চান, সেটি Images তালিকার প্রথমে রাখুন।
4. Save করলে slug URL স্বয়ংক্রিয়ভাবে তৈরি হবে এবং product active থাকলে Homepage-এ card ও নিজস্ব landing page-এ gallery দেখা যাবে।
5. Product active না থাকলে Homepage-এ প্রকাশ পাবে না; stock শেষ হলেও active card ও product details দেখা যাবে, তবে landing page-এ order বন্ধ থাকবে।

## ছবি সাজানো
- Homepage-এ একটি product-এর প্রথম ছবিটিই card cover।
- Product landing page-এ ওই product-এর সর্বোচ্চ ছয়টি ছবি স্বয়ংক্রিয় slideshow-এ দেখায়।
- Admin-এর Images list-এ ছবি reorder করে প্রথম ছবি বদলালে Homepage cover বদলাবে; landing page-এ ছবির ক্রমও সেই অনুযায়ী বদলাবে।
- মোবাইল ও desktop-এ একই gallery frame ব্যবহার হয়; ছবির আসল অনুপাত বজায় রাখতে `object-fit: contain` ব্যবহার করা হয়েছে।

## Footer ও যোগাযোগ
- Homepage, প্রতিটি product page এবং About/Contact/Policy page একই shared footer ব্যবহার করে; footer-এর জন্য আলাদা আলাদা page template সম্পাদনা করতে হয় না।
- Admin → Website Settings থেকে WhatsApp নম্বর সেট করুন। Footer, contact section ও floating WhatsApp button একই সেটিংস ব্যবহার করে।
- About, Contact, Delivery, Return/Exchange, Privacy এবং Admin link একই shared footer-এ থাকে। কোনো footer link বদলাতে হলে `app/static/footer.html`-ই একমাত্র source।

## Facebook বিজ্ঞাপনে ব্যবহার
- Admin-এর Product list থেকে নির্দিষ্ট product-এর page link কপি করুন। Facebook Ad-এর Website URL-এ ওই লিংক দিন।
- Slug পরিবর্তন করলে পুরোনো ad link আর কাজ করবে না; তাই চলমান বিজ্ঞাপন থাকলে URL পরিবর্তন করার আগে সেগুলো update করুন।
- Custom domain চালুর সময় Render Environment-এ `PUBLIC_SITE_URL` সেট করুন এবং Render → Settings → Custom Domains-এ domain যোগ করুন।

## অর্ডার ও ডেলিভারি
- প্রতিটি landing page-এর form শুধু ওই page-এর product order করে। COD অপরিবর্তিত।
- Backend stock, delivery fee, duplicate-order ও anti-spam checks নিজে যাচাই করে। Browser fee preview-কে চূড়ান্ত ধরা হয় না।
- শুধু `free_delivery` চালু থাকা `ফুল সেট` category product-এ delivery free; অন্য ক্ষেত্রে Admin settings-এর Dhaka/outside fee লাগবে।

## Production-এর আগে
Demo ছবি, দাম ও পণ্যের বিবরণ RIHAM-এর আসল অনুমোদিত তথ্য দিয়ে বদলান। Render, live Facebook preview, real WhatsApp number, Steadfast, database backup ও custom domain আলাদাভাবে পরীক্ষা করে তারপর বিজ্ঞাপন চালু করুন।
