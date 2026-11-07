# V8.2 পরিবর্তন যাচাই

## কোড পর্যায়ের যাচাই
- `node --check app/static/app.js` — পাস।
- `index.html` থেকে `order-section`, `inlineOrderForm`, `orderProductChoices` সম্মিলিত home form সরানো হয়েছে।
- Home lookbook caption-এর `অর্ডার করুন` link এখন `/${product.slug}` ব্যবহার করে; `#order` বা পুরোনো product-choice click handler নেই।
- `app.js` কেবল `data-page="landing"` থাকলেই order form initialize করে; হোমপেজে form selector-এ bind করে না।
- `product-landing.html`-এ পৃথক অর্ডার ফর্ম রাখা হয়েছে।
- Homepage ও product landing header/footer-এ একই “RIHAM STORE” branding এবং redesigned footer রাখা হয়েছে।

## সীমাবদ্ধতা
- এই runtime-এ v8.1 ZIP-এ কোনো local SQLite database ছিল না; TestClient boot-এ `site_config` টেবিল না থাকায় live API smoke test চালানো যায়নি।
- Chromium/Playwright visual viewport test এই রানেও করা হয়নি। Render deployment ও live Facebook ad click test প্রয়োজন।
