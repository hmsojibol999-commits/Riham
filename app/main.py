import os, re, json, time, secrets, hmac, uuid, logging, html
from pathlib import Path
from datetime import datetime, timezone, timedelta
from zoneinfo import ZoneInfo
from contextlib import asynccontextmanager
from typing import Optional, Literal
import requests
from dotenv import load_dotenv
load_dotenv()
from fastapi import FastAPI, Depends, HTTPException, Request, UploadFile, File
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse, RedirectResponse, Response
from fastapi.staticfiles import StaticFiles
from starlette.middleware.sessions import SessionMiddleware
from pydantic import BaseModel, Field, field_validator
from sqlalchemy.orm import Session
from sqlalchemy import select, update, text, or_, func
from .database import Base, engine, get_db
from .models import Product, Category, Order, SiteConfig

logging.basicConfig(level=logging.INFO)
log = logging.getLogger("riham")
DHAKA_TZ = ZoneInfo("Asia/Dhaka")
DIGIT_TRANSLATION = str.maketrans(
    "০১২৩৪৫৬৭৮৯٠١٢٣٤٥٦٧٨٩",
    "01234567890123456789",
)


def normalize_digits(value: str) -> str:
    """Convert Bengali/Arabic-Indic numerals to ASCII before validation."""
    return str(value or "").translate(DIGIT_TRANSLATION)


def normalize_bd_phone(value: str) -> str:
    """Return a canonical 01[3-9]XXXXXXXX Bangladesh mobile number."""
    digits = re.sub(r"\D", "", normalize_digits(value))
    if digits.startswith("880") and len(digits) == 13:
        digits = "0" + digits[3:]
    elif len(digits) == 10 and digits.startswith("1"):
        digits = "0" + digits
    if not re.fullmatch(r"01[3-9]\d{8}", digits):
        raise ValueError("১১ সংখ্যার সঠিক বাংলাদেশি মোবাইল নম্বর দিন।")
    return digits


def utc_iso(value: datetime | None) -> str | None:
    """Serialize naive database timestamps as UTC explicitly."""
    if value is None:
        return None
    if value.tzinfo is None:
        value = value.replace(tzinfo=timezone.utc)
    else:
        value = value.astimezone(timezone.utc)
    return value.isoformat(timespec="seconds").replace("+00:00", "Z")


def production_storage_ready() -> bool:
    required = ("CLOUDINARY_CLOUD_NAME", "CLOUDINARY_API_KEY", "CLOUDINARY_API_SECRET")
    return all(os.getenv(name, "").strip() for name in required)
ROOT = Path(__file__).resolve().parent.parent
STATIC = ROOT / "app" / "static"
UPLOADS = ROOT / "uploads"
UPLOADS.mkdir(exist_ok=True)

production = os.getenv("APP_ENV", "development").lower() == "production"
@asynccontextmanager
async def app_lifespan(application):
    initialize_app()
    yield


app = FastAPI(
    title="RIHAM Store",
    version="8.4.0",
    description="RIHAM modest fashion store",
    docs_url=None if production else "/docs",
    redoc_url=None if production else "/redoc",
    openapi_url=None if production else "/openapi.json",
    lifespan=app_lifespan,
)
app.add_middleware(
    SessionMiddleware,
    secret_key=os.getenv("SESSION_SECRET", "" ) or secrets.token_urlsafe(48),
    session_cookie="riham_admin_session",
    max_age=60 * 60 * 24,
    same_site="lax",
    https_only=os.getenv("COOKIE_SECURE", "false").lower() == "true",
)
app.mount("/static", StaticFiles(directory=STATIC), name="static")
app.mount("/uploads", StaticFiles(directory=UPLOADS), name="uploads")

CSP = (
    "default-src 'self'; "
    "script-src 'self' https://www.googletagmanager.com https://connect.facebook.net; "
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; "
    "font-src 'self' https://fonts.gstatic.com; "
    "img-src 'self' data: https: https://www.facebook.com; "
    "connect-src 'self' https://www.google-analytics.com https://region1.google-analytics.com https://analytics.google.com https://stats.g.doubleclick.net https://www.facebook.com https://graph.facebook.com; "
    "object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'"
)
UNSAFE_METHODS = {"POST", "PUT", "PATCH", "DELETE"}


def client_ip(request: Request) -> str:
    return request.client.host if request.client else "unknown"


@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    # Block cross-site state-changing requests (extra CSRF protection on top of SameSite cookies).
    if request.method in UNSAFE_METHODS and request.url.path.startswith("/api/"):
        origin = request.headers.get("origin")
        if origin and origin.split("://", 1)[-1].rstrip("/") != request.headers.get("host", ""):
            return JSONResponse({"detail": "অনুমোদিত নয়।"}, status_code=403)
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
    response.headers["Content-Security-Policy"] = CSP
    if production:
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    if request.url.path.startswith("/api/admin"):
        response.headers["Cache-Control"] = "no-store"
    elif request.url.path.startswith("/static/"):
        # Revalidate static assets on deploy so an old JS bundle is not paired
        # with a new backend. Add content-hash filenames before using long TTLs.
        response.headers["Cache-Control"] = "public, max-age=0, must-revalidate"
    return response

LOGIN_ATTEMPTS: dict[str, list[float]] = {}
ORDER_ATTEMPTS: dict[str, list[float]] = {}
PHONE_ORDER_ATTEMPTS: dict[str, list[float]] = {}
ORDER_LIMIT, ORDER_WINDOW = 6, 600  # max 6 orders per IP per 10 minutes


def rate_limited(store: dict, key: str, limit: int, window: int) -> bool:
    now = time.time()
    hits = [t for t in store.get(key, []) if now - t < window]
    if len(hits) >= limit:
        store[key] = hits
        return True
    hits.append(now)
    store[key] = hits
    if len(store) > 5000:  # keep memory bounded
        for k in [k for k, v in store.items() if not v or now - v[-1] > window]:
            store.pop(k, None)
    return False


def safe_image_url(value: str) -> str:
    value = (value or "").strip()
    if value and not (value.startswith("/uploads/") or value.startswith("/static/img/") or value.startswith("https://")):
        raise ValueError("ছবির লিংক নিরাপদ নয়।")
    return value


def clean_options(values: list[str]) -> list[str]:
    out = []
    for v in values:
        v = str(v).strip()
        if v and len(v) <= 50 and v not in out:
            out.append(v)
    return out

STATUSES = {"new", "confirmed", "processing", "shipped", "delivered", "cancelled"}

class LoginInput(BaseModel):
    access_key: str = Field(min_length=1, max_length=256)

class ProductInput(BaseModel):
    name: str = Field(min_length=2, max_length=180)
    slug: str = Field(default="", max_length=80)
    category: str = Field(default="বোরকা", max_length=80)
    description: str = Field(default="", max_length=5000)
    size_guide: str = Field(default="", max_length=3000)
    price: float = Field(ge=0)
    sale_price: Optional[float] = Field(default=None, ge=0)
    sizes: list[str] = Field(default_factory=list, max_length=20)
    colors: list[str] = Field(default_factory=list, max_length=20)
    images: list[str] = Field(default_factory=list, max_length=6)
    stock: int = Field(default=0, ge=0, le=100000)
    featured: bool = False
    active: bool = True
    free_delivery: bool = False

    @field_validator("name", "category", mode="before")
    @classmethod
    def _trim_product_text(cls, value):
        return str(value or "").strip()

    @field_validator("slug")
    @classmethod
    def _slug_ok(cls, v):
        v = (v or "").strip().lower()
        if v and v not in RESERVED_SLUGS and not re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)*", v):
            raise ValueError("পেজ লিংক শুধু ছোট ইংরেজি অক্ষর, সংখ্যা ও মাঝখানে হাইফেন দিয়ে লিখুন।")
        return v

    @field_validator("images")
    @classmethod
    def _images_ok(cls, v):
        return [safe_image_url(x) for x in v if x and x.strip()]

    @field_validator("sizes", "colors")
    @classmethod
    def _options_ok(cls, v):
        return clean_options(v)

class CategoryInput(BaseModel):
    name: str = Field(min_length=2, max_length=80)
    description: str = Field(default="", max_length=180)
    image: str = Field(default="", max_length=500)
    active: bool = True

    @field_validator("name", mode="before")
    @classmethod
    def _trim_category_name(cls, value):
        return str(value or "").strip()

    @field_validator("description", mode="before")
    @classmethod
    def _trim_category_description(cls, value):
        return str(value or "").strip()

    @field_validator("image")
    @classmethod
    def _cat_image_ok(cls, v):
        return safe_image_url(v)


class CategoryImageInput(BaseModel):
    image: str = Field(default="", max_length=500)

    @field_validator("image")
    @classmethod
    def _img_ok(cls, v):
        return safe_image_url(v)

class SettingsInput(BaseModel):
    store_name: str = Field(default="RIHAM", min_length=1, max_length=100)

    hero_title: str = Field(default="", max_length=220)
    hero_subtitle: str = Field(default="", max_length=300)
    hero_button: str = Field(default="কালেকশন দেখুন", max_length=80)
    hero_image: str = Field(default="", max_length=500)
    whatsapp_number: str = Field(default="", max_length=24)
    contact_text: str = Field(default="", max_length=220)
    announcement: str = Field(default="", max_length=220)
    delivery_fee: float = Field(default=80, ge=0, le=10000)  # legacy compatibility
    free_delivery_limit: float = Field(default=3000, ge=0, le=1000000)  # legacy compatibility
    dhaka_delivery_fee: float = Field(default=50, ge=0, le=10000)
    outside_delivery_fee: float = Field(default=100, ge=0, le=10000)
    footer_text: str = Field(default="", max_length=300)
    accent_color: str = Field(default="#3f5a3b", pattern=r"^#[0-9a-fA-F]{6}$")
    theme: str = Field(default="white", pattern=r"^(white|photo)$")
    background_color: str = Field(default="#ffffff", pattern=r"^#[0-9a-fA-F]{6}$")
    text_color: str = Field(default="#2b2926", pattern=r"^#[0-9a-fA-F]{6}$")
    tagline: str = Field(default="", max_length=180)
    trust_customer_count: str = Field(default="", max_length=40)
    trust_rating_value: str = Field(default="", max_length=8)
    trust_review_count: int = Field(default=0, ge=0, le=100000000)
    new_arrival_enabled: bool = False
    new_arrival_title: str = Field(default="", max_length=160)
    new_arrival_subtitle: str = Field(default="", max_length=260)
    new_arrival_image: str = Field(default="", max_length=500)
    feature_1_title: str = Field(default="", max_length=100)
    feature_1_text: str = Field(default="", max_length=240)
    feature_2_title: str = Field(default="", max_length=100)
    feature_2_text: str = Field(default="", max_length=240)
    feature_3_title: str = Field(default="", max_length=100)
    feature_3_text: str = Field(default="", max_length=240)
    feature_4_title: str = Field(default="", max_length=100)
    feature_4_text: str = Field(default="", max_length=240)
    review_images: list[str] = Field(default_factory=list, max_length=10)
    about_text: str = Field(default="", max_length=5000)
    support_phone: str = Field(default="", max_length=24)
    support_email: str = Field(default="", max_length=160)
    shop_address: str = Field(default="", max_length=300)
    facebook_url: str = Field(default="", max_length=500)
    instagram_url: str = Field(default="", max_length=500)
    delivery_policy: str = Field(default="", max_length=5000)
    return_policy: str = Field(default="", max_length=5000)
    privacy_policy: str = Field(default="", max_length=5000)
    seo_title: str = Field(default="", max_length=180)
    seo_description: str = Field(default="", max_length=320)
    seo_keywords: str = Field(default="", max_length=600)
    ga4_measurement_id: str = Field(default="", max_length=40)
    meta_pixel_id: str = Field(default="", max_length=40)

    @field_validator("store_name", mode="before")
    @classmethod
    def _store_name_ok(cls, value):
        value = str(value or "").strip()
        if not value:
            raise ValueError("স্টোরের নাম খালি রাখা যাবে না।")
        return value

    @field_validator("meta_pixel_id")
    @classmethod
    def _pixel_ok(cls, v):
        v = (v or "").strip()
        if v and not re.fullmatch(r"\d{8,20}", v):
            raise ValueError("Meta Pixel ID শুধু ৮–২০ সংখ্যার হতে হবে (যেমন 1234567890123456)।")
        return v

    @field_validator("ga4_measurement_id")
    @classmethod
    def _ga4_ok(cls, v):
        v = (v or "").strip()
        if v and not re.fullmatch(r"G-[A-Za-z0-9]{4,20}", v):
            raise ValueError("GA4 ID এই ফরম্যাটে দিন: G-XXXXXXXXXX")
        return v

    @field_validator("hero_image", "new_arrival_image")
    @classmethod
    def _hero_ok(cls, v):
        return safe_image_url(v)

    @field_validator("review_images")
    @classmethod
    def _review_images_ok(cls, values):
        return [safe_image_url(v) for v in values if v and v.strip()][:10]

    @field_validator("facebook_url", "instagram_url")
    @classmethod
    def _social_urls_ok(cls, value):
        value = (value or "").strip()
        if value and not value.startswith("https://"):
            raise ValueError("সোশ্যাল মিডিয়ার লিংক https:// দিয়ে শুরু হতে হবে।")
        return value

class OrderItemInput(BaseModel):
    product_id: int
    quantity: int = Field(ge=1, le=20)
    size: str = Field(default="", max_length=50)
    color: str = Field(default="", max_length=50)

class OrderInput(BaseModel):
    customer_name: str = Field(min_length=2, max_length=120)
    phone: str = Field(min_length=10, max_length=20)
    address: str = Field(min_length=8, max_length=1000)
    note: str = Field(default="", max_length=1000)
    items: list[OrderItemInput] = Field(min_length=1, max_length=30)
    delivery_area: Literal["dhaka", "outside"] = "outside"
    website: str = Field(default="", max_length=240)  # honeypot; humans leave this blank
    form_started_at: int = Field(default=0, ge=0)  # retained for old clients; not trusted as a clock

    @field_validator("customer_name", "address", "note", mode="before")
    @classmethod
    def _trim_order_text(cls, value):
        return str(value or "").strip()

    @field_validator("phone", mode="before")
    @classmethod
    def _normalize_phone_digits(cls, value):
        return re.sub(r"\D", "", normalize_digits(str(value or "")))

class StatusInput(BaseModel):
    status: str


RESERVED_SLUGS = {
    "admin", "api", "static", "uploads", "product", "p", "shop", "collections",
    "about", "contact", "policy", "robots.txt", "sitemap.xml", "docs", "redoc",
    "openapi.json", "health", "favicon.ico", "index", "order", "cart", "login",
}
SLUG_PATTERN = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")

def slugify(value: str, fallback: str = "") -> str:
    """Create a lowercase ASCII-only URL slug."""
    slug = re.sub(r"[^a-z0-9]+", "-", str(value or "").strip().lower()).strip("-")
    return slug[:80].strip("-") or fallback

def assert_slug_allowed(slug: str):
    if slug in RESERVED_SLUGS:
        raise HTTPException(400, "এই পেজ লিংকটি ব্যবহার করা যাবে না। অন্য একটি লিংক লিখুন।")
    if not SLUG_PATTERN.fullmatch(slug or ""):
        raise HTTPException(400, "পেজ লিংক শুধু ছোট ইংরেজি অক্ষর, সংখ্যা ও মাঝখানে হাইফেন দিয়ে লিখুন।")

def unique_product_slug(db: Session, base: str, exclude_id: int | None = None) -> str:
    base = (base or "product")[:80].strip("-") or "product"
    candidate, n = base, 2
    while True:
        query = select(Product.id).where(Product.slug == candidate)
        if exclude_id is not None:
            query = query.where(Product.id != exclude_id)
        if candidate not in RESERVED_SLUGS and db.scalar(query) is None:
            return candidate
        suffix = f"-{n}"
        candidate = base[:80-len(suffix)].rstrip("-") + suffix
        n += 1

def site_base_url(request: Request) -> str:
    return os.getenv("PUBLIC_SITE_URL", "").strip().rstrip("/") or str(request.base_url).rstrip("/")

def absolute_site_url(value: str, base_url: str) -> str:
    value = str(value or "").strip()
    if value.startswith("https://") or value.startswith("http://"):
        return value
    if value.startswith("/"):
        return base_url + value
    return base_url + "/" + value if value else ""

def html_template(name: str, replacements: dict[str, str]) -> str:
    content = (STATIC / name).read_text(encoding="utf-8")
    # One pass prevents an admin-entered value containing another placeholder
    # token from being interpreted as a second template instruction.
    return re.sub(r"__([A-Z0-9_]+)__", lambda match: replacements.get(match.group(1), match.group(0)), content)

def shared_footer_markup() -> str:
    """One server-rendered footer fragment shared by the home and product pages."""
    return (STATIC / "footer.html").read_text(encoding="utf-8")

def bn_money(value) -> str:
    try:
        return "৳" + format(float(value or 0), ",.0f")
    except (TypeError, ValueError):
        return "৳০"


FREE_DELIVERY_CATEGORIES = {"ফুল সেট", "full set", "full-set"}

def is_full_set_category_name(value: str) -> bool:
    category = re.sub(r"\s+", " ", str(value or "").strip().lower())
    return category in FREE_DELIVERY_CATEGORIES

def is_free_delivery_full_set(product: Product) -> bool:
    return bool(getattr(product, "free_delivery", False)) and is_full_set_category_name(product.category)


def ensure_config(db: Session) -> SiteConfig:
    cfg = db.get(SiteConfig, 1)
    if not cfg:
        cfg = SiteConfig(
            id=1,
            store_name=os.getenv("STORE_NAME", "RIHAM"),
            delivery_fee=float(os.getenv("DELIVERY_FEE", "80")),
            free_delivery_limit=float(os.getenv("FREE_DELIVERY_LIMIT", "3000")),
            dhaka_delivery_fee=float(os.getenv("DHAKA_DELIVERY_FEE", "50")),
            outside_delivery_fee=float(os.getenv("OUTSIDE_DELIVERY_FEE", "100")),
            theme=os.getenv("STORE_THEME", "white"),
            hero_title="বোরকা, হিজাব ও নিকাব—আপনার পছন্দের কালেকশন",
            hero_subtitle="পছন্দের ডিজাইন বেছে নিন, সাইজ ও রং নির্বাচন করে সহজেই অর্ডার করুন।",
            announcement="সম্পূর্ণ ফুল সেটে ডেলিভারি ফ্রি · অন্য পণ্যে নিয়মিত চার্জ",
        )
        db.add(cfg)
        db.commit()
        db.refresh(cfg)
    return cfg


def seed_demo(db: Session):
    """Seed local preview data once; never mutate existing products or categories."""
    ensure_config(db)
    if db.scalar(select(Category.id).limit(1)) is not None or db.scalar(select(Product.id).limit(1)) is not None:
        return

    # Reference images are only for local previews. Do not use this seed for a live store.
    safa_gallery = [
        "https://www.sarrahbd.com/images/safa-set/safa-1.jpeg",
        "https://www.sarrahbd.com/images/safa-set/safa-2.jpeg",
        "https://www.sarrahbd.com/images/safa-set/safa-3.jpeg",
    ]
    sarah_gallery = [
        "https://www.sarrahbd.com/images/sarah1/sr1.jpg",
        "https://www.sarrahbd.com/images/sarah1/sr2.jpg",
    ]
    muslima_gallery = [
        "https://www.sarrahbd.com/images/muslima-set/ms1.jpg",
        "https://www.sarrahbd.com/images/muslima-set/ms2.jpg",
    ]
    categories = [
        Category(name="বোরকা", description="বোরকার সামনের, পাশের ও পেছনের ভিউ"),
        Category(name="হিজাব", description="হিজাবের স্টাইল ও কাপড়ের কাছের ভিউ"),
        Category(name="নিকাব", description="নিকাবের ডিজাইন ও কভারেজ ভিউ"),
        Category(name="ফুল সেট", description="বোরকা + হিজাব + নিকাব একসঙ্গে"),
        Category(name="হিজাব + নিকাব", description="হিজাব ও নিকাবের কম্বো কালেকশন"),
    ]
    demos = [
        Product(
            name="সাফা প্রিমিয়াম ফুল সেট",
            slug="safa-premium-full-set",
            category="ফুল সেট",
            description="স্থানীয় preview-এর demo পণ্য। লাইভে দেওয়ার আগে বাস্তব পণ্যের ছবি, কাপড়, মাপ, রং ও মূল্য বসান।",
            price=2700, sale_price=2400,
            sizes=["৪৮", "৫০", "৫২", "৫৪", "৫৬", "৫৮"],
            colors=["কালো", "নেভি"], images=safa_gallery,
            stock=12, featured=True, free_delivery=True,
        ),
        Product(
            name="সারাহ এলিগ্যান্ট ফুল সেট",
            slug="sarah-elegant-full-set",
            category="ফুল সেট",
            description="স্থানীয় preview-এর demo পণ্য। লাইভে দেওয়ার আগে বাস্তব পণ্যের ছবি, বিবরণ ও মূল্য বসান।",
            price=2700, sale_price=2400,
            sizes=["৪৮", "৫০", "৫২", "৫৪", "৫৬", "৫৮"],
            colors=["কালো"], images=sarah_gallery,
            stock=10, featured=True, free_delivery=True,
        ),
        Product(
            name="মুসলিমা ডেইলি সেট",
            slug="muslima-daily-set",
            category="ফুল সেট",
            description="স্থানীয় preview-এর demo পণ্য। লাইভে দেওয়ার আগে বাস্তব পণ্যের ছবি, বিবরণ ও মূল্য বসান।",
            price=2600, sale_price=2400,
            sizes=["৪৮", "৫০", "৫২", "৫৪", "৫৬", "৫৮"],
            colors=["কালো"], images=muslima_gallery,
            stock=9, featured=True, free_delivery=True,
        ),
        Product(
            name="প্রিমিয়াম হিজাব",
            slug="premium-hijab-demo",
            category="হিজাব",
            description="স্থানীয় preview-এর demo পণ্য। লাইভে দেওয়ার আগে বাস্তব পণ্যের ছবি, বিবরণ ও মূল্য বসান।",
            price=650, sale_price=550,
            sizes=["ফ্রি সাইজ"], colors=["কালো", "অ্যাশ", "মেরুন"],
            images=[safa_gallery[1]], stock=25,
        ),
        Product(
            name="বেসিক ব্ল্যাক নিকাব",
            slug="basic-black-niqab-demo",
            category="নিকাব",
            description="স্থানীয় preview-এর demo পণ্য। লাইভে দেওয়ার আগে বাস্তব পণ্যের ছবি, বিবরণ ও মূল্য বসান।",
            price=400, sizes=["ফ্রি সাইজ"], colors=["কালো"],
            images=[sarah_gallery[1]], stock=20,
        ),
    ]
    db.add_all(categories + demos)
    db.commit()


WEAK_KEYS = ("demo-only", "change-me", "replace-with", "generate-a-long", "password", "12345678")


def check_secrets():
    key = os.getenv("ADMIN_ACCESS_KEY", "")
    secret = os.getenv("SESSION_SECRET", "")
    weak_key = len(key) < 12 or any(w in key.lower() for w in WEAK_KEYS)
    weak_secret = len(secret) < 32 or any(w in secret.lower() for w in WEAK_KEYS)
    if production:
        problems = []
        database_url = os.getenv("DATABASE_URL", "").strip()
        public_url = os.getenv("PUBLIC_SITE_URL", "").strip()
        if weak_key:
            problems.append("ADMIN_ACCESS_KEY (কমপক্ষে ১২ অক্ষরের শক্ত ও ইউনিক কী দিন)")
        if weak_secret:
            problems.append("SESSION_SECRET (কমপক্ষে ৩২ অক্ষরের random মান দিন)")
        if not database_url or database_url.startswith("sqlite"):
            problems.append("DATABASE_URL (production-এ persistent PostgreSQL URL বাধ্যতামূলক; SQLite fallback বন্ধ)")
        if not public_url.startswith("https://"):
            problems.append("PUBLIC_SITE_URL (নিজস্ব canonical https:// domain দিন)")
        if os.getenv("COOKIE_SECURE", "false").lower() != "true":
            problems.append("COOKIE_SECURE=true (HTTPS admin session cookie)")
        if problems:
            raise RuntimeError("Production শুরু করা যাবে না। ঠিক করুন: " + "; ".join(problems))
    elif not key:
        # Local development convenience: generate a one-time key instead of shipping a known one.
        generated = secrets.token_urlsafe(18)
        os.environ["ADMIN_ACCESS_KEY"] = generated
        log.warning("DEV MODE: temporary admin access key for this run -> %s", generated)


def migrate_v4():
    """Additive migration: older v3 store data is preserved."""
    from sqlalchemy import inspect, text
    insp = inspect(engine)
    tables = set(insp.get_table_names())
    with engine.begin() as conn:
        if "products" in tables:
            cols = {c["name"] for c in inspect(engine).get_columns("products")}
            if "free_delivery" not in cols:
                conn.execute(text("ALTER TABLE products ADD COLUMN free_delivery BOOLEAN DEFAULT FALSE"))
                conn.execute(text("UPDATE products SET free_delivery=TRUE WHERE category='ফুল সেট' OR lower(category) LIKE '%full set%'"))
        if "orders" in tables:
            cols = {c["name"] for c in inspect(engine).get_columns("orders")}
            if "delivery_area" not in cols:
                conn.execute(text("ALTER TABLE orders ADD COLUMN delivery_area VARCHAR(20) DEFAULT 'outside'"))
            if "fraud_flag" not in cols:
                conn.execute(text("ALTER TABLE orders ADD COLUMN fraud_flag BOOLEAN DEFAULT FALSE"))
            if "fraud_reason" not in cols:
                conn.execute(text("ALTER TABLE orders ADD COLUMN fraud_reason VARCHAR(240) DEFAULT ''"))
        if "site_config" in tables:
            cols = {c["name"] for c in inspect(engine).get_columns("site_config")}
            if "dhaka_delivery_fee" not in cols:
                conn.execute(text("ALTER TABLE site_config ADD COLUMN dhaka_delivery_fee FLOAT DEFAULT 50"))
            if "outside_delivery_fee" not in cols:
                conn.execute(text("ALTER TABLE site_config ADD COLUMN outside_delivery_fee FLOAT DEFAULT 100"))
            # v3 themes/images migration compatibility
            if "theme" not in cols:
                conn.execute(text("ALTER TABLE site_config ADD COLUMN theme VARCHAR(20) DEFAULT 'white'"))
            if "demo_seeded" not in cols:
                conn.execute(text("ALTER TABLE site_config ADD COLUMN demo_seeded INTEGER DEFAULT 1"))
            if "background_color" not in cols:
                conn.execute(text("ALTER TABLE site_config ADD COLUMN background_color VARCHAR(7) DEFAULT '#ffffff'"))
            if "text_color" not in cols:
                conn.execute(text("ALTER TABLE site_config ADD COLUMN text_color VARCHAR(7) DEFAULT '#2b2926'"))
            if "hero_image" not in cols:
                conn.execute(text("ALTER TABLE site_config ADD COLUMN hero_image VARCHAR(500) DEFAULT ''"))
            if "whatsapp_number" not in cols:
                conn.execute(text("ALTER TABLE site_config ADD COLUMN whatsapp_number VARCHAR(24) DEFAULT ''"))
            if "contact_text" not in cols:
                conn.execute(text("ALTER TABLE site_config ADD COLUMN contact_text VARCHAR(220) DEFAULT ''"))
            if "announcement" not in cols:
                conn.execute(text("ALTER TABLE site_config ADD COLUMN announcement VARCHAR(220) DEFAULT ''"))
            if "footer_text" not in cols:
                conn.execute(text("ALTER TABLE site_config ADD COLUMN footer_text VARCHAR(300) DEFAULT ''"))
            if "accent_color" not in cols:
                conn.execute(text("ALTER TABLE site_config ADD COLUMN accent_color VARCHAR(7) DEFAULT '#3f5a3b'"))


def migrate_v5():
    """Additive CMS/SEO/contact migration. Existing products, orders and settings stay intact."""
    from sqlalchemy import inspect, text
    insp = inspect(engine)
    if "site_config" not in set(insp.get_table_names()):
        return
    # Product-specific size-guide text is optional and does not alter existing variants.
    if "products" in set(insp.get_table_names()):
        product_cols = {c["name"] for c in insp.get_columns("products")}
        if "size_guide" not in product_cols:
            with engine.begin() as conn:
                conn.execute(text("ALTER TABLE products ADD COLUMN size_guide TEXT DEFAULT ''"))
    cols = {c["name"] for c in insp.get_columns("site_config")}
    additions = {
        "tagline": "VARCHAR(180) DEFAULT 'বোরকা, হিজাব ও নিকাবের মার্জিত কালেকশন'",
        "trust_customer_count": "VARCHAR(40) DEFAULT ''",
        "trust_rating_value": "VARCHAR(8) DEFAULT ''",
        "trust_review_count": "INTEGER DEFAULT 0",
        "new_arrival_enabled": "BOOLEAN DEFAULT FALSE",
        "new_arrival_title": "VARCHAR(160) DEFAULT 'নতুন কালেকশন'",
        "new_arrival_subtitle": "VARCHAR(260) DEFAULT 'নতুন পছন্দের ডিজাইনগুলো দেখে নিন।'",
        "new_arrival_image": "VARCHAR(500) DEFAULT ''",
        "feature_1_title": "VARCHAR(100) DEFAULT 'প্রিমিয়াম কোয়ালিটি'",
        "feature_1_text": "VARCHAR(240) DEFAULT 'পণ্যের কাপড় ও ফিনিশিংয়ের বিস্তারিত দেখে পছন্দ করুন.'",
        "feature_2_title": "VARCHAR(100) DEFAULT 'শালীন ডিজাইন'",
        "feature_2_text": "VARCHAR(240) DEFAULT 'বোরকা, হিজাব ও নিকাবের মার্জিত কালেকশন.'",
        "feature_3_title": "VARCHAR(100) DEFAULT 'সারা দেশে ডেলিভারি'",
        "feature_3_text": "VARCHAR(240) DEFAULT 'ঢাকায় ৳৫০, ঢাকার বাইরে ৳১০০; ফুল সেটে ফ্রি.'",
        "feature_4_title": "VARCHAR(100) DEFAULT 'গ্রাহক সহায়তা'",
        "feature_4_text": "VARCHAR(240) DEFAULT 'সাইজ, কালার ও অর্ডারের প্রশ্নে WhatsApp-এ সহায়তা নিন.'",
        "review_images_json": "TEXT DEFAULT '[]'",
        "about_text": "TEXT DEFAULT 'RIHAM-এ বোরকা, হিজাব ও নিকাবের নির্বাচিত কালেকশন এক জায়গায় পাবেন.'",
        "support_phone": "VARCHAR(24) DEFAULT ''",
        "support_email": "VARCHAR(160) DEFAULT ''",
        "shop_address": "VARCHAR(300) DEFAULT ''",
        "facebook_url": "VARCHAR(500) DEFAULT ''",
        "instagram_url": "VARCHAR(500) DEFAULT ''",
        "delivery_policy": "TEXT DEFAULT 'সারা বাংলাদেশে ক্যাশ অন ডেলিভারি। ফুল সেটে ডেলিভারি ফ্রি। অন্যান্য অর্ডারে ঢাকার ভিতরে ৳৫০ এবং ঢাকার বাইরে ৳১০০ ডেলিভারি চার্জ প্রযোজ্য.'",
        "return_policy": "TEXT DEFAULT 'রিটার্ন বা এক্সচেঞ্জের নিয়ম জানতে অর্ডার করার আগে আমাদের WhatsApp-এ যোগাযোগ করুন.'",
        "privacy_policy": "TEXT DEFAULT 'আপনার নাম, ফোন নম্বর ও ঠিকানা অর্ডার গ্রহণ, ফোনে নিশ্চিতকরণ এবং ডেলিভারির কাজে ব্যবহার করা হবে। ডেলিভারির জন্য প্রয়োজন হলে সংশ্লিষ্ট কুরিয়ার সেবাদাতার সঙ্গে প্রয়োজনীয় তথ্য শেয়ার করা হতে পারে.'",
        "seo_title": "VARCHAR(180) DEFAULT 'RIHAM | বোরকা, হিজাব ও নিকাব'",
        "seo_description": "VARCHAR(320) DEFAULT 'RIHAM-এ বোরকা, হিজাব ও নিকাবের মার্জিত কালেকশন দেখুন। সারা বাংলাদেশে ক্যাশ অন ডেলিভারি.'",
        "seo_keywords": "VARCHAR(600) DEFAULT 'বোরকা, হিজাব, নিকাব, ফুল সেট, modest wear Bangladesh'",
        "ga4_measurement_id": "VARCHAR(40) DEFAULT ''",
        "meta_pixel_id": "VARCHAR(40) DEFAULT ''",
    }
    with engine.begin() as conn:
        for name, ddl in additions.items():
            if name not in cols:
                conn.execute(text(f"ALTER TABLE site_config ADD COLUMN {name} {ddl}"))


def migrate_v6_slugs():
    """Repair legacy Unicode/reserved slugs without changing valid ASCII links."""
    from sqlalchemy import inspect
    insp = inspect(engine)
    if "products" not in set(insp.get_table_names()):
        return
    with Session(engine) as db:
        rows = db.scalars(select(Product).order_by(Product.id.asc())).all()
        # Reserve every currently-valid slug first so an earlier legacy row cannot
        # accidentally take a valid link belonging to a later product.
        keep = {str(row.slug) for row in rows if SLUG_PATTERN.fullmatch(str(row.slug or "")) and str(row.slug) not in RESERVED_SLUGS}
        for product in rows:
            current = str(product.slug or "")
            if SLUG_PATTERN.fullmatch(current) and current not in RESERVED_SLUGS:
                continue
            base = slugify(product.name, fallback=f"product-{product.id}")
            if base in RESERVED_SLUGS:
                base = f"product-{product.id}"
            candidate, n = base[:80], 2
            while candidate in keep:
                suffix = f"-{n}"
                candidate = base[:80-len(suffix)].rstrip("-") + suffix
                n += 1
            product.slug = candidate
            keep.add(candidate)
        db.commit()


def migrate_v7_courier_columns():
    """Add missing courier columns to databases created by earlier releases."""
    from sqlalchemy import inspect, text
    inspector = inspect(engine)
    if "orders" not in set(inspector.get_table_names()):
        return
    columns = {column["name"] for column in inspector.get_columns("orders")}
    additions = {
        "courier_consignment_id": "VARCHAR(80) DEFAULT ''",
        "courier_tracking_code": "VARCHAR(80) DEFAULT ''",
        "courier_status": "VARCHAR(80) DEFAULT ''",
    }
    with engine.begin() as conn:
        for name, ddl in additions.items():
            if name not in columns:
                conn.execute(text(f"ALTER TABLE orders ADD COLUMN {name} {ddl}"))


def initialize_app():
    check_secrets()
    migrate_v4()
    migrate_v5()
    Base.metadata.create_all(bind=engine)
    migrate_v6_slugs()
    migrate_v7_courier_columns()
    if not production and os.getenv("SEED_DEMO_DATA", "true").lower() == "true":
        with next(get_db()) as db:
            seed_demo(db)
    if not os.getenv("SESSION_SECRET"):
        log.warning("SESSION_SECRET is not set. A temporary session secret will be used; sessions reset on restart.")


def require_admin(request: Request):
    if request.session.get("admin") is not True:
        raise HTTPException(status_code=401, detail="প্রথমে Store Access দিয়ে লগইন করুন।")


def is_category_visible(db: Session, product: Product) -> bool:
    """An inactive category hides its products; uncategorized legacy names remain visible."""
    active_value = db.scalar(select(Category.active).where(Category.name == product.category))
    return active_value is None or bool(active_value)


def product_dict(p: Product):
    discount = 0
    if p.sale_price is not None and p.price > 0 and p.sale_price < p.price:
        discount = round((p.price - p.sale_price) / p.price * 100)
    return {
        "id": p.id, "name": p.name, "slug": p.slug, "category": p.category,
        "description": p.description, "size_guide": getattr(p, "size_guide", "") or "", "price": p.price, "sale_price": p.sale_price,
        "discount_percent": discount, "sizes": p.sizes or [], "colors": p.colors or [],
        "images": p.images or [], "stock": p.stock, "featured": p.featured,
        "active": p.active, "free_delivery": is_free_delivery_full_set(p), "created_at": utc_iso(p.created_at),
    }


def settings_dict(c: SiteConfig):
    keys = [
        "store_name", "hero_title", "hero_subtitle", "hero_button", "hero_image", "whatsapp_number", "contact_text", "announcement",
        "delivery_fee", "free_delivery_limit", "dhaka_delivery_fee", "outside_delivery_fee", "footer_text", "accent_color", "theme", "background_color", "text_color",
        "tagline", "trust_customer_count", "trust_rating_value", "trust_review_count", "new_arrival_enabled", "new_arrival_title", "new_arrival_subtitle", "new_arrival_image",
        "feature_1_title", "feature_1_text", "feature_2_title", "feature_2_text", "feature_3_title", "feature_3_text", "feature_4_title", "feature_4_text",
        "about_text", "support_phone", "support_email", "shop_address", "facebook_url", "instagram_url", "delivery_policy", "return_policy", "privacy_policy",
        "seo_title", "seo_description", "seo_keywords", "ga4_measurement_id", "meta_pixel_id"
    ]
    data = {k: getattr(c, k) for k in keys}
    try:
        data["review_images"] = json.loads(c.review_images_json or "[]")
    except (TypeError, json.JSONDecodeError):
        data["review_images"] = []
    return data


def order_dict(o: Order):
    return {"id": o.id, "invoice": o.invoice, "customer_name": o.customer_name, "phone": o.phone,
            "address": o.address, "note": o.note, "items": o.items, "subtotal": o.subtotal,
            "delivery_fee": o.delivery_fee, "total": o.total, "delivery_area": getattr(o, "delivery_area", "outside"),
            "fraud_flag": bool(getattr(o, "fraud_flag", False)), "fraud_reason": getattr(o, "fraud_reason", ""), "status": o.status,
            "courier_consignment_id": o.courier_consignment_id, "courier_tracking_code": o.courier_tracking_code,
            "courier_status": o.courier_status, "created_at": utc_iso(o.created_at)}



def public_order_receipt(o: Order):
    """Minimal receipt payload; never expose phone/address or internal risk-review fields."""
    return {
        "invoice": o.invoice,
        "subtotal": o.subtotal,
        "delivery_fee": o.delivery_fee,
        "total": o.total,
        "status": o.status,
        "created_at": utc_iso(o.created_at),
    }

@app.get("/")
def home(request: Request, db: Session = Depends(get_db)):
    cfg = ensure_config(db)
    base = site_base_url(request)
    first = db.scalar(select(Product).where(Product.active.is_(True), ~Product.category.in_(select(Category.name).where(Category.active.is_(False)))).order_by(Product.featured.desc(), Product.id.desc()))
    image = (cfg.hero_image or "").strip()
    image = image or (next((str(item).strip() for item in (first.images or []) if str(item).strip()), "") if first else "")
    title = cfg.seo_title or f"{cfg.store_name or 'RIHAM'} | বোরকা, হিজাব ও নিকাব"
    description = cfg.seo_description or "বোরকা, হিজাব ও নিকাবের মার্জিত কালেকশন। সারা বাংলাদেশে ক্যাশ অন ডেলিভারি।"
    description_meta = re.sub(r"\s+", " ", description).strip()[:160]
    image_url = absolute_site_url(image, base)
    replacements = {
        "HOME_TITLE": html.escape(title, quote=True),
        "HOME_DESCRIPTION": html.escape(description_meta, quote=True),
        "HOME_OG_TITLE": html.escape(title, quote=True),
        "HOME_OG_DESCRIPTION": html.escape(description_meta, quote=True),
        "HOME_OG_IMAGE": html.escape(image_url, quote=True),
        "HOME_OG_URL": html.escape(base + "/", quote=True),
        "HOME_CANONICAL": html.escape(base + "/", quote=True),
        "SHARED_FOOTER": shared_footer_markup(),
    }
    return HTMLResponse(html_template("index.html", replacements))

@app.get("/admin")
def admin_page():
    return FileResponse(STATIC / "admin.html")

@app.get("/product/{product_id}")
def product_page(product_id: int, db: Session = Depends(get_db)):
    product = db.get(Product, product_id)
    if not product or not product.active or not is_category_visible(db, product):
        return HTMLResponse((STATIC / "not-found.html").read_text(encoding="utf-8"), status_code=404)
    return RedirectResponse(url=f"/{product.slug}", status_code=301)

@app.get("/shop")
@app.get("/collections")
def shop_page():
    return RedirectResponse(url="/#lookbook", status_code=307)

@app.get("/about")
@app.get("/contact")
@app.get("/policy/{policy_name}")
def information_page(policy_name: str = "about"):
    if policy_name not in {"delivery", "return", "privacy", "about", "contact"}:
        raise HTTPException(404, "পেজটি পাওয়া যায়নি।")
    return HTMLResponse(html_template("info.html", {"SHARED_FOOTER": shared_footer_markup()}))

@app.get("/robots.txt")
def robots(request: Request):
    base = site_base_url(request)
    return Response("User-agent: *\nAllow: /\nDisallow: /admin\nSitemap: " + base + "/sitemap.xml\n", media_type="text/plain")

@app.get("/sitemap.xml")
def sitemap(request: Request, db: Session = Depends(get_db)):
    base = site_base_url(request)
    urls = ["/", "/shop", "/about", "/contact", "/policy/delivery", "/policy/return", "/policy/privacy"]
    urls += [f"/{p.slug}" for p in db.scalars(select(Product).where(Product.active.is_(True))).all()]
    from xml.sax.saxutils import escape as xml_escape
    xml = '<?xml version="1.0" encoding="UTF-8"?>' + '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' + ''.join(f'<url><loc>{xml_escape(base + u)}</loc></url>' for u in urls) + '</urlset>'
    return Response(xml, media_type="application/xml")

@app.get("/api/health")
def health(db: Session = Depends(get_db)):
    try:
        db.execute(text("SELECT 1"))
    except Exception:
        log.exception("Health check database query failed")
        raise HTTPException(503, "database unavailable")
    return {"status": "ok", "database": "ok", "app": "RIHAM", "version": "8.4.0"}

@app.get("/api/products")
def public_products(category: str | None = None, search: str | None = None, db: Session = Depends(get_db)):
    q = select(Product).where(Product.active.is_(True), ~Product.category.in_(select(Category.name).where(Category.active.is_(False))))
    if category:
        q = q.where(Product.category == category)
    if search:
        term = search[:80].replace("!", "!!").replace("%", "!%").replace("_", "!_")
        q = q.where(Product.name.ilike(f"%{term}%", escape="!"))
    return [product_dict(p) for p in db.scalars(q.order_by(Product.featured.desc(), Product.id.desc())).all()]

@app.get("/api/products/by-slug/{slug}")
def public_product_by_slug(slug: str, db: Session = Depends(get_db)):
    p = db.scalar(select(Product).where(Product.slug == slug))
    if not p or not p.active or not is_category_visible(db, p):
        raise HTTPException(404, "পণ্যটি পাওয়া যায়নি।")
    return product_dict(p)

@app.get("/api/products/{product_id}")
def public_product(product_id: int, db: Session = Depends(get_db)):
    p = db.get(Product, product_id)
    if not p or not p.active or not is_category_visible(db, p):
        raise HTTPException(404, "পণ্যটি পাওয়া যায়নি।")
    return product_dict(p)

@app.get("/api/categories")
def public_categories(db: Session = Depends(get_db)):
    return [{"id": c.id, "name": c.name, "description": c.description, "image": c.image or ""} for c in db.scalars(select(Category).where(Category.active.is_(True)).order_by(Category.id)).all()]

@app.get("/api/settings")
def public_settings(db: Session = Depends(get_db)):
    return settings_dict(ensure_config(db))

@app.post("/api/orders")
def create_order(payload: OrderInput, request: Request, db: Session = Depends(get_db)):
    # A server-side timer cannot trust the customer's device clock. Keep the
    # honeypot and server-side rate limits; ignore the legacy client timestamp.
    if payload.website.strip():
        raise HTTPException(400, "অর্ডারটি গ্রহণ করা যায়নি। আবার চেষ্টা করুন।")

    try:
        phone_digits = normalize_bd_phone(payload.phone)
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc

    stock_needed: dict[int, int] = {}
    items, subtotal = [], 0.0
    qualifies_for_free_delivery = bool(payload.items)
    product_snapshots: dict[int, Product] = {}

    # Validate all customer-selected options and calculate prices server-side.
    for line in payload.items:
        stock_needed[line.product_id] = stock_needed.get(line.product_id, 0) + line.quantity
        product = db.get(Product, line.product_id)
        if not product or not product.active or not is_category_visible(db, product):
            raise HTTPException(400, "কার্টে থাকা একটি পণ্য এখন পাওয়া যাচ্ছে না।")
        if product.sizes and line.size not in product.sizes:
            raise HTTPException(400, f"{product.name} পণ্যের জন্য সঠিক সাইজ নির্বাচন করুন।")
        if product.colors and line.color not in product.colors:
            raise HTTPException(400, f"{product.name} পণ্যের জন্য সঠিক রং নির্বাচন করুন।")
        effective_price = product.sale_price if product.sale_price is not None and product.sale_price < product.price else product.price
        unit = float(effective_price)
        subtotal += unit * line.quantity
        qualifies_for_free_delivery = qualifies_for_free_delivery and is_free_delivery_full_set(product)
        items.append({
            "product_id": product.id,
            "name": product.name,
            "quantity": line.quantity,
            "unit_price": unit,
            "size": line.size,
            "color": line.color,
        })
        product_snapshots[product.id] = product

    # Avoid duplicate submissions without revealing a previous invoice number.
    now_naive = datetime.now(timezone.utc).replace(tzinfo=None)
    cutoff = now_naive - timedelta(minutes=10)
    recent = db.scalars(
        select(Order).where(
            Order.phone == phone_digits,
            Order.created_at >= cutoff,
            Order.status.in_(["new", "confirmed", "processing"]),
        ).order_by(Order.created_at.desc()).limit(12)
    ).all()
    requested_signature = sorted(
        (x["product_id"], x["quantity"], x["size"], x["color"]) for x in items
    )
    for recent_order in recent:
        previous_signature = sorted(
            (int(x["product_id"]), int(x["quantity"]), x.get("size", ""), x.get("color", ""))
            for x in recent_order.items
        )
        if previous_signature == requested_signature:
            raise HTTPException(409, "এই নম্বর থেকে একই অর্ডারটি ইতিমধ্যে নেওয়া হয়েছে। প্রয়োজনে আমাদের সঙ্গে যোগাযোগ করুন।")

    # Only validated, non-duplicate submissions consume rate-limit quota.
    ip = client_ip(request)
    if rate_limited(ORDER_ATTEMPTS, ip, ORDER_LIMIT, ORDER_WINDOW):
        raise HTTPException(429, "এই নেটওয়ার্ক থেকে অনেক অর্ডার পাঠানো হয়েছে। কিছুক্ষণ পরে আবার চেষ্টা করুন।")
    if rate_limited(PHONE_ORDER_ATTEMPTS, phone_digits, 4, 3600):
        raise HTTPException(429, "এই নম্বর থেকে এক ঘণ্টায় অনেক অর্ডার এসেছে। ফোনে যোগাযোগ করে অর্ডার নিশ্চিত করুন।")

    # Atomic conditional UPDATE is the inventory guard. Unlike a Python-side
    # read/modify/write, this also protects SQLite deployments where FOR UPDATE
    # is ignored. A failed update rolls back every stock deduction in this order.
    try:
        for product_id, quantity in stock_needed.items():
            result = db.execute(
                update(Product)
                .where(
                    Product.id == product_id,
                    Product.active.is_(True),
                    Product.stock >= quantity,
                )
                .values(stock=Product.stock - quantity)
                .execution_options(synchronize_session=False)
            )
            if result.rowcount != 1:
                db.rollback()
                product = product_snapshots.get(product_id)
                name = product.name if product else "পণ্যটি"
                raise HTTPException(409, f"{name} পণ্যের স্টক শেষ বা পরিবর্তিত হয়েছে। পেজ রিফ্রেশ করে আবার চেষ্টা করুন।")

        cfg = ensure_config(db)
        if qualifies_for_free_delivery:
            fee = 0.0
        elif payload.delivery_area == "dhaka":
            fee = float(cfg.dhaka_delivery_fee)
        else:
            fee = float(cfg.outside_delivery_fee)

        # A repeat phone number is a manual-confirmation hint, not proof of fraud.
        hour_cutoff = now_naive - timedelta(hours=1)
        same_phone_recent = db.scalar(
            select(Order.id).where(
                Order.phone == phone_digits,
                Order.created_at >= hour_cutoff,
            ).limit(1)
        )
        repeat_review = same_phone_recent is not None
        review_reason = (
            "একই নম্বর থেকে গত ১ ঘণ্টায় আরেকটি অর্ডার এসেছে—কুরিয়ারে পাঠানোর আগে ফোনে নিশ্চিত করুন।"
            if repeat_review else ""
        )

        invoice_date = datetime.now(DHAKA_TZ).strftime("%y%m%d")
        invoice = f"RIH-{invoice_date}-{secrets.token_hex(3).upper()}"
        order = Order(
            invoice=invoice,
            customer_name=payload.customer_name,
            phone=phone_digits,
            address=payload.address,
            note=payload.note,
            items=items,
            subtotal=round(subtotal, 2),
            delivery_fee=fee,
            total=round(subtotal + fee, 2),
            delivery_area=payload.delivery_area,
            fraud_flag=repeat_review,
            fraud_reason=review_reason,
            status="new",
        )
        db.add(order)
        db.commit()
        db.refresh(order)
        return {
            "message": "আপনার অর্ডারটি গ্রহণ করা হয়েছে।",
            "order": public_order_receipt(order),
        }
    except HTTPException:
        raise
    except Exception:
        db.rollback()
        log.exception("Order creation failed; transaction rolled back")
        raise HTTPException(500, "অর্ডারটি সংরক্ষণ করা যায়নি। কিছুক্ষণ পরে আবার চেষ্টা করুন।")


@app.post("/api/admin/login")
def admin_login(payload: LoginInput, request: Request):
    ip = client_ip(request)
    now = time.time()
    attempts = [t for t in LOGIN_ATTEMPTS.get(ip, []) if now - t < 900]
    if len(attempts) >= 8:
        raise HTTPException(429, "অনেকবার চেষ্টা করা হয়েছে। ১৫ মিনিট পরে আবার চেষ্টা করুন।")
    expected = os.getenv("ADMIN_ACCESS_KEY", "")
    if not expected or not hmac.compare_digest(payload.access_key.encode(), expected.encode()):
        attempts.append(now)
        LOGIN_ATTEMPTS[ip] = attempts
        raise HTTPException(401, "Secret Access Key সঠিক নয়।")
    LOGIN_ATTEMPTS.pop(ip, None)
    request.session.clear()
    request.session["admin"] = True
    request.session["login_at"] = int(now)
    return {"ok": True, "message": "লগইন সফল হয়েছে।"}

@app.post("/api/admin/logout")
def admin_logout(request: Request):
    request.session.clear()
    return {"ok": True}

@app.get("/api/admin/me")
def admin_me(request: Request):
    require_admin(request)
    return {"ok": True}

@app.get("/api/admin/products")
def admin_products(request: Request, db: Session = Depends(get_db)):
    require_admin(request)
    return [product_dict(p) for p in db.scalars(select(Product).order_by(Product.id.desc())).all()]

@app.post("/api/admin/products")
def create_product(payload: ProductInput, request: Request, db: Session = Depends(get_db)):
    require_admin(request)
    if payload.sale_price is not None and payload.sale_price >= payload.price:
        raise HTTPException(400, "ডিসকাউন্টের দাম মূল দামের চেয়ে কম হতে হবে।")
    if len(payload.images) > 6:
        raise HTTPException(400, "সর্বোচ্চ ৬টি ছবি যোগ করা যাবে।")
    if payload.free_delivery and not is_full_set_category_name(payload.category):
        raise HTTPException(400, "শুধু সম্পূর্ণ ফুল সেট ক্যাটাগরির পণ্যে ফ্রি ডেলিভারি চালু করা যাবে।")
    requested_slug = (payload.slug or "").strip().lower()
    if requested_slug:
        assert_slug_allowed(requested_slug)
        if db.scalar(select(Product.id).where(Product.slug == requested_slug)) is not None:
            raise HTTPException(400, "এই পেজ লিংকটি আগে থেকেই ব্যবহার হচ্ছে। অন্য একটি লিংক দিন।")
        slug = requested_slug
    else:
        base = slugify(payload.name)
        slug = unique_product_slug(db, base) if base else f"product-{uuid.uuid4().hex[:8]}"
    data = payload.model_dump()
    data.pop("slug", None)
    p = Product(**data, slug=slug)
    db.add(p)
    db.flush()
    if not requested_slug and not slugify(payload.name):
        p.slug = unique_product_slug(db, f"product-{p.id}")
    db.commit(); db.refresh(p)
    return product_dict(p)

@app.put("/api/admin/products/{product_id}")
def update_product(product_id: int, payload: ProductInput, request: Request, db: Session = Depends(get_db)):
    require_admin(request)
    p = db.get(Product, product_id)
    if not p: raise HTTPException(404, "পণ্য পাওয়া যায়নি।")
    if payload.sale_price is not None and payload.sale_price >= payload.price:
        raise HTTPException(400, "ডিসকাউন্টের দাম মূল দামের চেয়ে কম হতে হবে।")
    if len(payload.images) > 6: raise HTTPException(400, "সর্বোচ্চ ৬টি ছবি যোগ করা যাবে।")
    if payload.free_delivery and not is_full_set_category_name(payload.category):
        raise HTTPException(400, "শুধু সম্পূর্ণ ফুল সেট ক্যাটাগরির পণ্যে ফ্রি ডেলিভারি চালু করা যাবে।")
    if "slug" in payload.model_fields_set:
        requested_slug = (payload.slug or "").strip().lower()
        if not requested_slug:
            base = slugify(payload.name, fallback=f"product-{p.id}")
            requested_slug = unique_product_slug(db, base, exclude_id=p.id)
    else:
        requested_slug = p.slug
    assert_slug_allowed(requested_slug)
    if db.scalar(select(Product.id).where(Product.slug == requested_slug, Product.id != p.id)) is not None:
        raise HTTPException(400, "এই পেজ লিংকটি অন্য একটি পণ্যে ব্যবহার হচ্ছে। অন্য লিংক দিন।")
    data = payload.model_dump()
    data.pop("slug", None)
    for key, value in data.items(): setattr(p, key, value)
    p.slug = requested_slug
    db.commit(); db.refresh(p)
    return product_dict(p)

@app.delete("/api/admin/products/{product_id}")
def delete_product(product_id: int, request: Request, db: Session = Depends(get_db)):
    require_admin(request)
    p = db.get(Product, product_id)
    if not p: raise HTTPException(404, "পণ্য পাওয়া যায়নি।")
    db.delete(p); db.commit()
    return {"ok": True}

@app.get("/api/admin/categories")
def admin_categories(request: Request, db: Session = Depends(get_db)):
    require_admin(request)
    return [{"id": c.id, "name": c.name, "description": c.description, "image": c.image or "", "active": c.active} for c in db.scalars(select(Category).order_by(Category.id)).all()]

@app.post("/api/admin/categories")
def add_category(payload: CategoryInput, request: Request, db: Session = Depends(get_db)):
    require_admin(request)
    name = payload.name.strip()
    if db.scalar(select(Category).where(Category.name == name)):
        raise HTTPException(400, "এই ক্যাটাগরি আগে থেকেই আছে।")
    c = Category(name=name, description=payload.description, image=payload.image, active=payload.active)
    db.add(c); db.commit(); db.refresh(c)
    return {"id": c.id, "name": c.name, "description": c.description, "image": c.image, "active": c.active}

@app.put("/api/admin/categories/{category_id}")
def update_category(category_id: int, payload: CategoryInput, request: Request, db: Session = Depends(get_db)):
    require_admin(request)
    category = db.get(Category, category_id)
    if not category:
        raise HTTPException(404, "ক্যাটাগরি পাওয়া যায়নি।")
    new_name = payload.name.strip()
    duplicate = db.scalar(select(Category).where(Category.name == new_name, Category.id != category_id))
    if duplicate:
        raise HTTPException(400, "এই নামে আরেকটি ক্যাটাগরি আগে থেকেই আছে।")
    old_name = category.name
    category.name = new_name
    category.description = payload.description.strip()
    category.image = payload.image
    category.active = payload.active
    if old_name != new_name:
        db.query(Product).filter(Product.category == old_name).update({Product.category: new_name}, synchronize_session=False)
    db.commit()
    db.refresh(category)
    return {"id": category.id, "name": category.name, "description": category.description, "image": category.image, "active": category.active}


@app.put("/api/admin/categories/{category_id}/image")
def set_category_image(category_id: int, payload: CategoryImageInput, request: Request, db: Session = Depends(get_db)):
    require_admin(request)
    c = db.get(Category, category_id)
    if not c: raise HTTPException(404, "ক্যাটাগরি পাওয়া যায়নি।")
    c.image = payload.image; db.commit()
    return {"ok": True, "image": c.image}

@app.delete("/api/admin/categories/{category_id}")
def remove_category(category_id: int, request: Request, db: Session = Depends(get_db)):
    require_admin(request)
    c = db.get(Category, category_id)
    if not c: raise HTTPException(404, "ক্যাটাগরি পাওয়া যায়নি।")
    c.active = False; db.commit()
    return {"ok": True}

@app.put("/api/admin/settings")
def update_settings(payload: SettingsInput, request: Request, db: Session = Depends(get_db)):
    require_admin(request)
    cfg = ensure_config(db)
    data = payload.model_dump()
    # Restrict WhatsApp number to digits and optional leading +.
    number = re.sub(r"[\s()-]", "", data["whatsapp_number"])
    if number and not re.fullmatch(r"\+?\d{10,15}", number):
        raise HTTPException(400, "WhatsApp নম্বরটি country code-সহ সঠিকভাবে লিখুন।")
    data["whatsapp_number"] = number
    if data["trust_rating_value"]:
        try:
            rating = float(data["trust_rating_value"])
        except ValueError:
            raise HTTPException(400, "Rating ০ থেকে ৫-এর মধ্যে সংখ্যা হতে হবে।")
        if not 0 <= rating <= 5:
            raise HTTPException(400, "Rating ০ থেকে ৫-এর মধ্যে হতে হবে।")
    if data["support_phone"]:
        data["support_phone"] = re.sub(r"[\s()-]", "", data["support_phone"])
        if not re.fullmatch(r"\+?\d{10,15}", data["support_phone"]):
            raise HTTPException(400, "সাপোর্ট ফোন নম্বরটি সঠিকভাবে লিখুন।")
    if data["support_email"] and not re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+", data["support_email"]):
        raise HTTPException(400, "সঠিক ইমেইল ঠিকানা লিখুন।")
    review_images = data.pop("review_images", [])
    cfg.review_images_json = json.dumps(review_images[:10], ensure_ascii=False)
    for key, value in data.items(): setattr(cfg, key, value)
    db.commit(); db.refresh(cfg)
    return settings_dict(cfg)

def detect_image_ext(data: bytes) -> str | None:
    """Identify real image files by their signature (the browser-sent content-type can be faked)."""
    if data.startswith(b"\xff\xd8\xff"):
        return ".jpg"
    if data.startswith(b"\x89PNG\r\n\x1a\n"):
        return ".png"
    if data[:4] == b"RIFF" and data[8:12] == b"WEBP":
        return ".webp"
    if data[:6] in (b"GIF87a", b"GIF89a"):
        return ".gif"
    return None


@app.post("/api/admin/uploads")
def upload_images(request: Request, files: list[UploadFile] = File(...)):
    require_admin(request)
    if not files or len(files) > 6:
        raise HTTPException(400, "একবারে ১ থেকে ৬টি ছবি আপলোড করুন।")
    urls = []
    cloud_ready = production_storage_ready()
    if production and not cloud_ready:
        raise HTTPException(503, "Live সাইটে ছবি সংরক্ষণের জন্য Cloudinary সেটিংস প্রয়োজন। স্থানীয় uploads production-এ ব্যবহার করা হবে না।")
    for f in files:
        data = f.file.read(8 * 1024 * 1024 + 1)
        if len(data) > 8 * 1024 * 1024:
            raise HTTPException(400, "প্রতিটি ছবি সর্বোচ্চ ৮ MB হতে পারবে।")
        ext = detect_image_ext(data)
        if not ext:
            raise HTTPException(400, "শুধু JPG, PNG, WEBP বা GIF ছবি আপলোড করা যাবে।")
        if cloud_ready:
            try:
                import io
                import cloudinary, cloudinary.uploader
                cloudinary.config(cloud_name=os.getenv("CLOUDINARY_CLOUD_NAME"), api_key=os.getenv("CLOUDINARY_API_KEY"), api_secret=os.getenv("CLOUDINARY_API_SECRET"), secure=True)
                result = cloudinary.uploader.upload(io.BytesIO(data), folder="riham/products", resource_type="image")
                urls.append(result["secure_url"])
            except Exception as exc:
                log.exception("Cloudinary upload failed")
                raise HTTPException(502, "Image storage upload ব্যর্থ হয়েছে। Cloudinary settings পরীক্ষা করুন।") from exc
        else:
            name = f"{uuid.uuid4().hex}{ext}"
            (UPLOADS / name).write_bytes(data)
            urls.append(f"/uploads/{name}")
    return {"urls": urls, "storage": "cloudinary" if cloud_ready else "local-demo"}

@app.get("/api/admin/orders")
def admin_orders(request: Request, db: Session = Depends(get_db)):
    require_admin(request)
    return [order_dict(o) for o in db.scalars(select(Order).order_by(Order.created_at.desc())).all()]

@app.put("/api/admin/orders/{order_id}/status")
def update_order_status(order_id: int, payload: StatusInput, request: Request, db: Session = Depends(get_db)):
    require_admin(request)
    if payload.status not in STATUSES:
        raise HTTPException(400, "অবৈধ order status।")
    order = db.get(Order, order_id)
    if not order:
        raise HTTPException(404, "অর্ডার পাওয়া যায়নি।")
    old_status, new_status = order.status, payload.status
    if old_status == new_status:
        return order_dict(order)

    allowed = {
        "new": {"confirmed", "cancelled"},
        "confirmed": {"processing", "cancelled"},
        "processing": {"shipped", "delivered", "cancelled"},
        "shipped": {"delivered"},
        "delivered": set(),
        "cancelled": {"new"},
    }
    if new_status not in allowed.get(old_status, set()):
        raise HTTPException(409, f"{old_status} থেকে {new_status} স্ট্যাটাসে পরিবর্তন অনুমোদিত নয়।")
    if new_status == "cancelled" and (old_status in {"shipped", "delivered"} or order.courier_consignment_id or order.courier_status in {"submitting", "unknown"}):
        raise HTTPException(409, "কুরিয়ারে পাঠানো অর্ডার সরাসরি বাতিল করা যাবে না। আগে কুরিয়ারের সঙ্গে সমন্বয় করুন।")

    try:
        transition = db.execute(
            update(Order)
            .where(Order.id == order_id, Order.status == old_status)
            .values(status=new_status)
            .execution_options(synchronize_session=False)
        )
        if transition.rowcount != 1:
            db.rollback()
            raise HTTPException(409, "অর্ডারের স্ট্যাটাস অন্য Admin পরিবর্তন করেছেন। তালিকা রিফ্রেশ করে আবার দেখুন।")

        if new_status == "cancelled":
            for item in order.items:
                product = db.get(Product, int(item["product_id"]))
                if product:
                    db.execute(
                        update(Product)
                        .where(Product.id == product.id)
                        .values(stock=Product.stock + int(item["quantity"]))
                        .execution_options(synchronize_session=False)
                    )
        elif old_status == "cancelled":
            needed: dict[int, int] = {}
            for item in order.items:
                product_id = int(item["product_id"])
                needed[product_id] = needed.get(product_id, 0) + int(item["quantity"])
            for product_id, quantity in needed.items():
                result = db.execute(
                    update(Product)
                    .where(Product.id == product_id, Product.active.is_(True), Product.stock >= quantity)
                    .values(stock=Product.stock - quantity)
                    .execution_options(synchronize_session=False)
                )
                if result.rowcount != 1:
                    db.rollback()
                    raise HTTPException(409, "এই অর্ডারটি আবার চালু করার মতো পর্যাপ্ত স্টক নেই।")
        db.commit()
        db.refresh(order)
        return order_dict(order)
    except HTTPException:
        raise
    except Exception:
        db.rollback()
        log.exception("Order status update failed")
        raise HTTPException(500, "অর্ডারের স্ট্যাটাস আপডেট করা যায়নি।")


@app.post("/api/admin/orders/{order_id}/steadfast")
def send_to_steadfast(order_id: int, request: Request, db: Session = Depends(get_db)):
    require_admin(request)
    order = db.get(Order, order_id)
    if not order:
        raise HTTPException(404, "অর্ডার পাওয়া যায়নি।")
    if order.status != "confirmed":
        raise HTTPException(400, "কুরিয়ারে পাঠানোর আগে কাস্টমারের সঙ্গে ফোনে কথা বলে অর্ডারটি Confirm করুন।")
    if order.courier_consignment_id or order.courier_tracking_code or order.courier_status in {"submitting", "unknown"}:
        raise HTTPException(409, "এই অর্ডারের courier request আগেই শুরু হয়েছে বা result অনিশ্চিত। Merchant panel-এ invoice মিলিয়ে নিন; যাচাই ছাড়া আবার পাঠাবেন না।")

    api_key = os.getenv("STEADFAST_API_KEY", "")
    secret_key = os.getenv("STEADFAST_SECRET_KEY", "")
    if not api_key or not secret_key:
        raise HTTPException(400, "Steadfast API credentials এখনো যোগ করা হয়নি।")
    base = os.getenv("STEADFAST_BASE_URL", "https://portal.steadfast.com.bd/api/v1").rstrip("/")
    if len(order.address or "") > 250:
        raise HTTPException(400, "Steadfast-এর জন্য ঠিকানা ২৫০ অক্ষরের বেশি। Admin থেকে ঠিকানা সংক্ষিপ্ত করে সেভ করুন।")
    payload = {
        "invoice": order.invoice,
        "recipient_name": order.customer_name[:100],
        "recipient_phone": normalize_bd_phone(order.phone),
        "recipient_address": order.address[:250],
        "cod_amount": round(order.total, 2),
        "note": (order.note or "")[:200],
        "item_description": ", ".join(f"{item['name']} x{item['quantity']}" for item in order.items)[:250],
        "total_lot": sum(int(item["quantity"]) for item in order.items),
        "delivery_type": 0,
    }

    # Claim the send operation atomically. A Python-side check followed by a
    # plain assignment is racy: two admin requests can both pass the check.
    claim = db.execute(
        update(Order)
        .where(
            Order.id == order_id,
            Order.status == "confirmed",
            or_(Order.courier_consignment_id.is_(None), Order.courier_consignment_id == ""),
            or_(Order.courier_tracking_code.is_(None), Order.courier_tracking_code == ""),
            func.coalesce(Order.courier_status, "").notin_(["submitting", "unknown"]),
        )
        .values(courier_status="submitting")
        .execution_options(synchronize_session=False)
    )
    db.commit()
    if claim.rowcount != 1:
        raise HTTPException(409, "অন্য Admin এই অর্ডারের courier request শুরু করেছেন বা অর্ডারের তথ্য বদলেছে। তালিকা রিফ্রেশ করুন।")

    try:
        response = requests.post(
            f"{base}/create_order",
            json=payload,
            headers={
                "Api-Key": api_key,
                "Secret-Key": secret_key,
                "Content-Type": "application/json",
            },
            timeout=25,
        )
        response.raise_for_status()
        data = response.json()
        status_code = data.get("status")
        consignment = data.get("consignment") or data.get("data") or {}
        if not isinstance(consignment, dict):
            consignment = {}
        consignment_id = consignment.get("consignment_id") or data.get("consignment_id")
        tracking_code = consignment.get("tracking_code") or data.get("tracking_code")
        success = (
            status_code in (200, "200", "success", "Success", True)
            or str(consignment.get("status", "")).lower() == "success"
            or bool(consignment_id and tracking_code)
        )
        if not success or not consignment_id or not tracking_code:
            # Missing identifiers can mean an accepted request with an unexpected
            # response schema. Treat it as ambiguous rather than risk a duplicate.
            order.courier_status = "unknown"
            db.commit()
            raise HTTPException(502, "Steadfast response-এ tracking তথ্য পাওয়া যায়নি। Merchant panel-এ invoice যাচাই করুন; যাচাই ছাড়া পুনরায় পাঠাবেন না।")

        order.courier_consignment_id = str(consignment_id)
        order.courier_tracking_code = str(tracking_code)
        order.courier_status = str(consignment.get("status") or "created")
        order.status = "processing"
        db.commit()
        db.refresh(order)
        return {
            "order": order_dict(order),
            "courier": {
                "consignment_id": order.courier_consignment_id,
                "tracking_code": order.courier_tracking_code,
                "status": order.courier_status,
            },
        }
    except HTTPException:
        raise
    except requests.RequestException as exc:
        # Timeout/network failures are ambiguous: courier may already have accepted it.
        db.rollback()
        try:
            order = db.get(Order, order_id)
            if order and not order.courier_consignment_id:
                order.courier_status = "unknown"
                db.commit()
        except Exception:
            db.rollback()
            log.exception("Could not persist ambiguous Steadfast result")
        log.exception("Steadfast API request failed")
        raise HTTPException(
            502,
            "Steadfast request-এর ফল নিশ্চিত নয়। Merchant panel-এ invoice খুঁজে না দেখে আবার পাঠাবেন না।",
        ) from exc
    except Exception as exc:
        db.rollback()
        try:
            order = db.get(Order, order_id)
            if order and not order.courier_consignment_id:
                order.courier_status = "unknown"
                db.commit()
        except Exception:
            db.rollback()
        log.exception("Steadfast response could not be processed")
        raise HTTPException(
            502,
            "Steadfast response নিশ্চিত করা যায়নি। Merchant panel-এ invoice যাচাই করুন; পুনরায় পাঠানোর আগে support নিন।",
        ) from exc


@app.post("/api/admin/orders/{order_id}/steadfast/reset")
def reset_ambiguous_steadfast(order_id: int, request: Request, db: Session = Depends(get_db)):
    """Allow a retry only after an admin checks the merchant portal manually."""
    require_admin(request)
    order = db.get(Order, order_id)
    if not order:
        raise HTTPException(404, "অর্ডার পাওয়া যায়নি।")
    if order.status != "confirmed" or order.courier_consignment_id or order.courier_tracking_code:
        raise HTTPException(409, "এই অর্ডারের courier তথ্য reset করা নিরাপদ নয়।")
    if order.courier_status not in {"submitting", "unknown"}:
        raise HTTPException(409, "এই অর্ডারে ambiguous courier request নেই।")
    reset = db.execute(
        update(Order)
        .where(
            Order.id == order_id,
            Order.status == "confirmed",
            or_(Order.courier_consignment_id.is_(None), Order.courier_consignment_id == ""),
            or_(Order.courier_tracking_code.is_(None), Order.courier_tracking_code == ""),
            Order.courier_status.in_(["submitting", "unknown"]),
        )
        .values(courier_status="")
        .execution_options(synchronize_session=False)
    )
    db.commit()
    if reset.rowcount != 1:
        raise HTTPException(409, "Courier status অন্য Admin পরিবর্তন করেছেন। তালিকা রিফ্রেশ করে আবার যাচাই করুন।")
    return {"ok": True, "message": "Merchant panel যাচাইয়ের পর retry চালু করা হয়েছে।"}


@app.get("/{slug}")
def product_landing(slug: str, request: Request, db: Session = Depends(get_db)):
    # This one-segment catch-all is intentionally declared after every fixed route and mount.
    if not re.fullmatch(r"[a-z0-9-]+", slug):
        raise HTTPException(404, "পেজটি পাওয়া যায়নি।")
    product = db.scalar(select(Product).where(Product.slug == slug))
    if not product or not product.active or not is_category_visible(db, product):
        return HTMLResponse((STATIC / "not-found.html").read_text(encoding="utf-8"), status_code=404)
    cfg = ensure_config(db)
    base = site_base_url(request)
    canonical = base + "/" + product.slug
    title = f"{product.name} | {cfg.store_name or 'RIHAM'}"
    description = product.description or f"{product.name} — সারা বাংলাদেশে ক্যাশ অন ডেলিভারি।"
    description_meta = re.sub(r"\s+", " ", description).strip()[:160]
    image = next((str(item).strip() for item in (product.images or []) if str(item).strip()), "")
    if not image:
        image = cfg.hero_image or ""
    image_url = absolute_site_url(image, base)
    effective_price = product.sale_price if product.sale_price is not None and product.sale_price < product.price else product.price
    availability = "https://schema.org/InStock" if int(product.stock or 0) > 0 else "https://schema.org/OutOfStock"
    json_ld = {
        "@context": "https://schema.org", "@type": "Product", "name": product.name,
        "description": description, "image": [image_url] if image_url else [],
        "sku": str(product.id), "offers": {"@type": "Offer", "priceCurrency": "BDT",
        "price": str(round(float(effective_price or 0), 2)), "availability": availability, "url": canonical},
    }
    json_ld_text = json.dumps(json_ld, ensure_ascii=False, separators=(",", ":"))
    json_ld_text = json_ld_text.replace("&", "\\u0026").replace("<", "\\u003c").replace(">", "\\u003e")
    sale_valid = product.sale_price is not None and product.sale_price < product.price
    price_html = (
        f"<strong>{html.escape(bn_money(effective_price))}</strong><del>{html.escape(bn_money(product.price))}</del><span>{round((product.price - effective_price) / product.price * 100) if product.price else 0}% ছাড়</span>"
        if sale_valid else f"<strong>{html.escape(bn_money(product.price))}</strong>"
    )
    size_guide_html = f"<div class=\"landing-size-guide\"><b>সাইজ গাইড</b><p>{html.escape(product.size_guide or '')}</p></div>" if product.size_guide else ""
    stock_note = f"স্টকে আছে · {product.stock}টি" if int(product.stock or 0) > 0 else "স্টক শেষ"
    replacements = {
        "PRODUCT_TITLE": html.escape(title, quote=True),
        "PRODUCT_NAME": html.escape(product.name),
        "PRODUCT_PRICE_HTML": price_html,
        "PRODUCT_DESCRIPTION_TEXT": html.escape(product.description or "পণ্যের বিস্তারিত জানতে WhatsApp-এ যোগাযোগ করুন।"),
        "PRODUCT_SIZE_GUIDE_HTML": size_guide_html,
        "PRODUCT_STOCK_NOTE": html.escape(stock_note),
        "PRODUCT_DESCRIPTION": html.escape(description_meta, quote=True),
        "PRODUCT_OG_TITLE": html.escape(title, quote=True),
        "PRODUCT_OG_DESCRIPTION": html.escape(description_meta, quote=True),
        "PRODUCT_OG_IMAGE": html.escape(image_url, quote=True),
        "PRODUCT_OG_URL": html.escape(canonical, quote=True),
        "PRODUCT_CANONICAL": html.escape(canonical, quote=True),
        "PRODUCT_JSON_LD": json_ld_text,
        "PRODUCT_SLUG": html.escape(product.slug, quote=True),
        "HEADER_ORDER_HREF": "#landingProductDetails" if int(product.stock or 0) <= 0 else "#order",
        "HEADER_ORDER_CLASS": "stock-unavailable" if int(product.stock or 0) <= 0 else "",
        "HEADER_ORDER_DISABLED": "true" if int(product.stock or 0) <= 0 else "false",
        "SHARED_FOOTER": shared_footer_markup(),
    }
    return HTMLResponse(html_template("product-landing.html", replacements))
