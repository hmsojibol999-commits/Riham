# RIHAM V8.1 — পরীক্ষার প্রতিবেদন

## পরীক্ষার পরিবেশ
- Local FastAPI application এবং SQLite database-এ পরীক্ষা হয়েছে।
- FastAPI `TestClient` দিয়ে API, route, raw HTML এবং database order পরীক্ষা করা হয়েছে।
- `pip install -r requirements.txt` চালানোর চেষ্টা করা হয়েছিল; package index-এর DNS/network না থাকায় `psycopg` resolve করা যায়নি। এই environment-এ `cloudinary`-ও ইনস্টল ছিল না। V8.1-এর জন্য নতুন কোনো package যোগ করা হয়নি।

## সফলভাবে পরীক্ষা করা হয়েছে
- ছয়টি demo product-এর প্রত্যেকটির `/{slug}` URL HTTP 200 দিয়েছে। Raw HTML-এ title, description, OG title/description/image/url, canonical এবং Product JSON-LD পাওয়া গেছে।
- Admin-এ লেখা product name/description-এর `<`, `>`, `&`, quote এবং script-এর মতো text HTML-escaped হয়েছে; executable markup ঢোকেনি।
- অজানা slug এবং inactive product-এর page HTTP 404 ও বাংলা not-found page দিয়েছে।
- `GET /api/products/by-slug/{slug}` সঠিক product dict দিয়েছে।
- পুরোনো `/product/{id}` active product-এর slug URL-এ HTTP 301 redirect দিয়েছে।
- Existing route/mount পরীক্ষা: `/`, `/admin`, `/about`, `/contact`, `/policy/delivery`, `/shop`, `/robots.txt`, `/sitemap.xml`, `/api/health`, `/api/products`, `/static/app.js`, `/uploads/.gitkeep` ও development `/docs` সঠিকভাবে সাড়া দিয়েছে।
- Sitemap-এ active product-এর `/{slug}` URL আছে; পুরোনো `/product/{id}` URL নেই।
- Admin API-তে custom slug, ফাঁকা slug auto-generation, duplicate slug rejection, update slug এবং বাংলা-only নামের `product-<id>` fallback পাস করেছে। `Admin`/`Product`-এর মতো reserved নাম থেকেও `admin-2` / `product-2`-এর মতো safe slug তৈরি হয়েছে।
- ২২টি reserved slug-এর প্রতিটিই create-এ HTTP 400 দিয়েছে; reserved slug update এবং duplicate slug create-ও প্রত্যাখ্যাত হয়েছে।
- v8 কোড দিয়ে তৈরি পুরোনো SQLite database-এর copy v8.1-এ চালিয়ে startup migration পরীক্ষা হয়েছে: বাংলা slug `product-4` হয়েছে, বাকি পাঁচটি valid ASCII slug অপরিবর্তিত থেকেছে এবং product details, stock ও আগে থেকে থাকা order অক্ষত ছিল।
- `PUBLIC_SITE_URL` দিলে product/home canonical, homepage OG image, sitemap ও robots-এ সেই base URL ব্যবহৃত হয়েছে। Homepage-এর OG image প্রথম active product-এর প্রথম image থেকে নেওয়া হয়েছে (demo photo hotlink রাখা হয়েছে, brief অনুযায়ী)।
- COD order API `+8801...` নম্বর গ্রহণ করে `01...`-এ normalize করেছে, order row তৈরি করেছে ও stock কমিয়েছে। Full-set order-এ delivery free ছিল; non-full-set outside-Dhaka order-এ configured ৳১০০ fee ছিল।
- Stock ০ product-এর landing HTML-এ `স্টক শেষ` এবং শুরু থেকেই disabled order submit button; header order link-ও disabled state-এ server-render হয়েছে।
- `python -m py_compile app/main.py`, `node --check app/static/app.js` এবং `node --check app/static/admin.js` পাস করেছে। Uvicorn server চালিয়ে `/api/health` ও product landing route-এ HTTP 200 পাওয়া গেছে।
- Fake Pixel ID দিয়ে Node VM harness-এ `window.fbq.queue` পরীক্ষা করে `PageView`, `ViewContent`, `InitiateCheckout`, `Purchase` পাওয়া গেছে; sample payload-এ customer name/phone/address ছিল না।

## এই environment-এ যাচাই করা যায়নি
- Chromium executable ছিল, কিন্তু Playwright দিয়ে local app-এ navigate করতে গেলে environment `net::ERR_BLOCKED_BY_ADMINISTRATOR` দিয়েছে। তাই 390px mobile/desktop visual rendering, live browser form interaction, Admin copy button click এবং browser console **যাচাই হয়নি**। Node VM queue test Pixel loader-এর; browser UI থেকে event trigger হওয়া আলাদাভাবে যাচাই করা যায়নি।
- Facebook crawler/link preview বাস্তবে fetch, Render deployment, live Steadfast order, PostgreSQL startup/migration এবং custom-domain DNS পরীক্ষা করা হয়নি।
- Product landing-এর Pixel ViewContent, InitiateCheckout ও Purchase event code যোগ হয়েছে। Fake Pixel queue-তে event command দেখা গেছে; browser interaction থেকে trigger এবং Meta-তে real event delivery যাচাই করা যায়নি।

## Brief-এর বাইরে করা পরিবর্তন
- `render.yaml`-এ `PUBLIC_SITE_URL` environment entry যোগ করা হয়েছে, যাতে Render dashboard থেকেই domain base বদলানো যায়।
- App ও health endpoint version `8.1.0` করা হয়েছে।
- অব্যবহৃত legacy cart-based `product.html` ও `product.js` বাদ দেওয়া হয়েছে; `/product/{id}` route 301 redirect করে।
- Runtime dependency যোগ করা হয়নি। Delivery calculation, order validation/anti-spam, Admin authentication, Steadfast integration code অপরিবর্তিত রাখা হয়েছে।
