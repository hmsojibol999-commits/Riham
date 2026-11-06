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
