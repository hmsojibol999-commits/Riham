# RIHAM Store — Master Demo v8.1

Mobile-first Bengali e-commerce demo for modest wear: **বোরকা, হিজাব, নিকাব, ফুল সেট**. v7 rebuilds the public home page around the client’s Sarrah reference lookbook and order-form layout, while keeping RIHAM's own branding and client-owned information separate.

## v8.1 additions
- Automatic public landing page for every active product at `/{slug}`, with up to six product-only images and a single-product Cash-on-Delivery order form.
- ASCII-safe editable slugs, reserved/duplicate validation, and additive startup repair for legacy Unicode/reserved slugs.
- Product-page SEO/Open Graph/Twitter metadata and Product JSON-LD injected in server HTML; homepage Open Graph image is selected from the first active product.
- Admin shows each full product page URL with copy/open actions and a warning before changing an existing ad link.
- `PUBLIC_SITE_URL` controls canonical, social-preview, sitemap and robots URLs; without it, the request host is used.
- Shared mode-aware `app.js` is used by both homepage and product pages; no extra runtime dependency.

## v7 additions
- Updated the six-product demo catalogue with 17 unique reference-site product-photo URLs across front, side, back and detail views.
- Replaced the public home page with a full-height vertical lookbook: one large image per frame, with no public category section or small product-card grid.
- Put the complete Cash-on-Delivery order form inside the home page, including product, size, quantity, contact/address, delivery area, dynamic total and confirm action.
- Kept Admin product and internal category management; the order form uses the full-set / hijab+niqab group internally.
- Preserved backend delivery enforcement: full-set-only orders are free; a mixed or non-full-set order pays the configured area fee.
- Rebranded application metadata, invoice prefix, defaults and visible storefront to RIHAM.

## v5 additions
- Tagline and optional social-proof strip (customer count, rating and review count are hidden until real values are entered).
- Admin-managed New Arrival banner and image.
- Four editable value-proposition / benefit cards.
- Up to five customer review images in a swipeable gallery (publish only with permission).
- About, Contact, Delivery, Return/Exchange and Privacy pages.
- Admin-managed support phone, email, address, Facebook and Instagram links.
- SEO title, description, keywords, Open Graph tags, ClothingStore/Product JSON-LD, `robots.txt` and `sitemap.xml`.
- Optional GA4 and Meta Pixel IDs; tracking scripts load only when valid IDs are configured.
- Product-specific size-guide text and WhatsApp order message with selected options and price.
- A clear three-step order guide on the homepage.
- Additive v5 database migration; existing v4 products/orders/settings remain intact.

## Existing store features
- V8.1 public home: full-height photo lookbook and same-page Cash-on-Delivery order form; no public category menu/tiles. Each active product also has an automatic `/{slug}` product-only landing page. `/product/{id}` now permanently redirects to the slug URL.
- Product variants, stock, discount price preview and free-delivery product flag.
- Full-set free delivery; other products use Dhaka/outside Dhaka area charges.
- Admin login with a server-side secret, order dashboard, repeat-order warnings, bot-trap and rate limits.
- Admin-managed WhatsApp number and Steadfast integration preparation.

## Run locally
1. Extract the ZIP and open a terminal inside `riham-store`.
2. Copy `.env.example` to `.env`.
3. Set a private `ADMIN_ACCESS_KEY` and long random `SESSION_SECRET`. Never commit `.env` to GitHub.
4. Install: `pip install -r requirements.txt`.
5. Run: `uvicorn app.main:app --reload`.
6. Store: `http://127.0.0.1:8000`; Admin: `http://127.0.0.1:8000/admin`.

The local demo uses SQLite. No API key is needed to test products, cart, COD checkout or the admin panel. A fresh database seeds six demo products; an existing database keeps its existing product catalogue rather than overwriting client-managed data.

## Delivery logic (v7)
- Only complete burqa + hijab + niqab full-set products should have **Free Delivery** enabled in Admin. Keep it off for a standalone hijab, standalone niqab, or hijab + niqab combo.
- Delivery is free only when **every item** in the cart is marked as a free-delivery full set. If a customer adds a non-qualifying product to a full set, the order gets the selected delivery-area charge.
- Otherwise, customers choose Dhaka (default ৳50) or outside Dhaka (default ৳100).
- The backend recalculates this rule; changing browser-side values cannot make delivery free.
- Admin may change the delivery rates in Website Settings.

Before launch, verify that each product marked as a full set really includes burqa + hijab + niqab.

## Admin workflow
- Products: add/edit price, sale price, category, stock, sizes, colours, six images, size guide and the public page slug. Copy the page URL in the product list for Facebook ads.
- New Arrival: enable/disable, title, description and upload one banner image.
- Benefits: edit four title/description cards.
- Reviews: upload up to five real customer images; get permission before publishing.
- Trust strip: customer count and rating fields are optional. Do not enter Sarrah BD's statistics; use only RIHAM's accurate figures.
- Contact: manage WhatsApp number, phone, email, address, Facebook and Instagram.
- Policy: enter the client's real return/exchange terms. The default text is only a starter, not legal advice.
- SEO/Analytics: edit title/description/keywords and optionally add GA4/Meta Pixel IDs.

## Environment and integrations
- `ADMIN_ACCESS_KEY`: admin secret; never add it to frontend code.
- `SESSION_SECRET`: secure session signing value.
- `DATABASE_URL`: SQLite locally or Supabase PostgreSQL for hosted use.
- `STEADFAST_API_KEY` / `STEADFAST_SECRET_KEY`: leave blank for demo; add client merchant credentials only to hosting Environment Variables.
- `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`: optional persistent image storage. Without Cloudinary, local uploads may be lost on a redeploy/restart on some hosts.
- `PUBLIC_SITE_URL`: optional canonical website origin used for product/home canonical metadata, Open Graph URLs, sitemap and robots; leave blank to use the incoming request host.

## Fake-order protection limits
The demo uses a honeypot field, minimum form time, IP/phone rate limiting and duplicate-order detection. These reduce spam but do not verify a customer's identity and cannot guarantee all fake orders are blocked. Admin should call the customer and mark the order **ফোনে নিশ্চিত** before courier submission. SMS OTP is not included.

## Demo product photos and prices
The starter catalogue uses public product-photo URLs from the Sarrah BD reference website (`sarrahbd.com`) so the client can preview the visual presentation. Those photos contain Sarrah branding/watermarks and are **temporary reference assets**, not RIHAM-owned images. Replace them with client-approved, RIHAM-owned product photographs before launch. The six starter products and their BDT prices are demo placeholders; confirm the actual catalogue, sizes, colours, stock and sale prices with the client. The 17 unique photo URLs are not stored as local image files inside this ZIP; the storefront loads them from the reference website. Remote reference images require the source site to remain available; uploading approved images through Admin avoids that dependency.

## Reference information deliberately not copied
The reference TXT describes another brand. RIHAM does not inherit Sarrah BD's logo/name, phone number, Asiya Collection, customer count, 5-star rating, social accounts, or review photos. Use RIHAM's actual client-provided content in Admin. The reference file itself marks several pages and product details as unverified; do not treat assumptions as confirmed facts.

## Production checklist
- Deploy using client-owned domain, hosting, database and image-storage accounts.
- Set `APP_ENV=production`, `COOKIE_SECURE=true`, strong `ADMIN_ACCESS_KEY`, and a 32+ character random `SESSION_SECRET`.
- Verify Supabase PostgreSQL, persistent images, database backups and restore process.
- Confirm actual catalogue, measurements, prices, customer review permissions, support channels and return/exchange policy.
- Add client Steadfast credentials and confirm pickup/merchant setup; perform a real test only with client approval.
- Confirm analytics/privacy wording before enabling GA4 or Meta Pixel.
- Run a complete order → phone confirmation → courier workflow before live launch.

**This ZIP is a testable demo foundation, not a production security audit or a guarantee against all fake orders.**


## V7 storefront update

- The public home page is now a mobile-first, full-height editorial photo collection. Each product image is displayed as a large vertical lookbook frame instead of a small product-card grid.
- Storefront category navigation/tiles are removed. Admin's internal product/category management is retained so staff can still maintain products.
- All lookbook photos are sourced from the client-provided Sarrah BD reference website's public product galleries. They are embedded as original HTTPS image URLs, not copied into this ZIP as local binary assets. The reference host must remain available for the demo images to load. Original source marks remain in those images; replace them through Admin uploads with approved clean RIHAM assets before launch if required.
- The order form is embedded directly in the home page. Product, size, quantity, customer name, phone, full delivery address, delivery area, COD payment, delivery charge and total are shown together. The form submits to the existing server-side order API.
- Full-set-only free delivery is calculated by the backend. A mixed or non-full-set order pays the configured area fee.
- Admin can change the lookbook by editing each product's Images list (up to six per product). Image slot order controls the order shown in the collection; removing an image shifts the remaining photos forward. Images are remote references and still carry whatever source watermark exists.


## V8.1 product ad links
- Add a product in Admin → পণ্য পরিচালনা. Its page link is created automatically from the product name using ASCII letters/numbers and hyphens. Bengali-only names use `product-<id>` unless an English slug is entered.
- Copy the URL from the product list and use it as the Facebook ad destination. The landing page contains only that product.
- Changing a slug changes the ad URL. There is no slug-history redirect in this version; Admin asks for confirmation and warns that old running ad links will stop working. Update existing ads after changing it.
- To move to a custom domain later: set `PUBLIC_SITE_URL=https://your-domain` in Render Environment, then add the same domain under Render → Settings → Custom Domains and configure the DNS records Render shows. No source-code edit is needed.
- See `HOW_TO_USE_V8_1_BN.md` for the owner-facing Bengali instructions and `TEST_REPORT_BN.md` for test limitations/results.

### V8.2 storefront navigation
The homepage is a product lookbook only; it no longer contains the combined order form. Each product's “অর্ডার করুন” link opens that product's own `/{slug}` landing page, where its individual COD order form remains available. The shared storefront identity is “RIHAM STORE”.
