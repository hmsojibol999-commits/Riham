# RIHAM STORE v8.3 — Test Report

## পাস করা পরীক্ষা

1. `python -m py_compile app/main.py app/models.py app/database.py` — PASS.
2. `node --check app/static/app.js` — PASS.
3. FastAPI `TestClient` + SQLite fresh test DB — Homepage `/` 200; ৬টি seeded active product-এর প্রতিটি `/{slug}` 200.
4. Homepage, ছয়টি product landing এবং পাঁচটি About/Contact/Policy response-এ `__SHARED_FOOTER__` placeholder নেই; একই `footer-contact-line`, Brand, WhatsApp, About, Contact, Delivery, Return, Privacy ও Admin footer markup server-side inject হয়েছে — PASS.
5. Existing route checks — `/admin`, `/about`, `/contact`, `/policy/delivery`, `/robots.txt`, `/sitemap.xml`, `/api/health`, `/static/app.js` 200; `/shop` আগের মতো `/#lookbook`-এ 307 redirect দেয়.
6. Chromium in-memory visual/interaction test, 390×844 ও 1365×900 — PASS (API data mock করা): Homepage-এ ৬টি product card, প্রতি card-এ একটিমাত্র image, product CTA slug path-এ যায়, homepage-এ `#inlineOrderForm` নেই এবং shared footer একবার করে আছে.
7. Chromium landing-page test, 390×844 ও 1365×900 — PASS (API data mock করা): তিনটি product image একই gallery track-এ, order form একটি, shared footer একটি; প্রায় ২.৮ সেকেন্ড পরে computed track transform বদলেছে, অর্থাৎ autoplay slide চলেছে.
8. Chromium page errors ও console error messages — কোনো JavaScript error ধরা পড়েনি। Info page script-এ shared footer WhatsApp নম্বর `+8801712345678` mock settings থেকে দেখিয়েছে — PASS.
9. `requirements.txt` অপরিবর্তিত; নতুন runtime dependency যোগ করা হয়নি.

## সীমাবদ্ধতা / এখনো করা হয়নি

- Chromium-এ local HTTP URL (`http://127.0.0.1:8765/`) খুলতে environment `ERR_BLOCKED_BY_ADMINISTRATOR` দিয়েছে। তাই browser test-এ actual network navigation নয়; TestClient থেকে পাওয়া server-rendered HTML Chromium `set_content`-এ চালানো হয়েছে এবং API response mock করা হয়েছে.
- Live remote demo images, customer-uploaded image persistence, actual WhatsApp click-through এবং Facebook crawler/link preview পরীক্ষা করা হয়নি.
- Render deployment, production PostgreSQL, Steadfast live account/courier workflow পরীক্ষা করা হয়নি.
- Live order submission/stock mutation v8.2 থেকে অপরিবর্তিত code path; এই v8.3 UI task-এ নতুন order logic যোগ বা বদলানো হয়নি.

## এই সংস্করণে পরিবর্তনের সীমানা

- `app/static/app.js`: Home product card renderer ও landing carousel; existing COD form submit logic untouched.
- `app/static/index.html`: Home product-list section; no homepage order form; shared footer placeholder.
- `app/static/product-landing.html`: landing gallery region ও shared footer placeholder; single-product COD form retained.
- `app/static/info.html`, `info.js`: About/Contact/Policy পেজ একই header/footer পায়; info content ও WhatsApp number settings থেকে আসে.
- `app/static/footer.html`: new single source for storefront footer.
- `app/static/v7.css`: card sizing, scroll reveal, carousel and shared footer styling.
- `app/main.py`: shared footer server-side injection and version metadata 8.3.0.
- README, HANDOFF, CHANGES, START_HERE, owner guide and test report updated.
