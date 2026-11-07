import os
import sys
import threading
from pathlib import Path

# Pin tests to an isolated local database before importing the app/engine.
TEST_DB = Path(os.getenv("RIHAM_TEST_DB", "/tmp/riham_v84_pytest.sqlite3"))
try:
    TEST_DB.unlink()
except FileNotFoundError:
    pass

os.environ["APP_ENV"] = "development"
os.environ["DATABASE_URL"] = f"sqlite:///{TEST_DB}"
os.environ["ADMIN_ACCESS_KEY"] = "test-admin-access-key-8f3b2a"
os.environ["SESSION_SECRET"] = "test-session-secret-32-characters-or-longer"
os.environ["SEED_DEMO_DATA"] = "false"
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

import pytest
import requests
from fastapi.testclient import TestClient
from pydantic import ValidationError
from sqlalchemy import select

from app import main
from app.database import Base, engine, SessionLocal
from app.models import Category, Order, Product, SiteConfig


@pytest.fixture()
def client():
    main.ORDER_ATTEMPTS.clear()
    main.PHONE_ORDER_ATTEMPTS.clear()
    main.LOGIN_ATTEMPTS.clear()
    Base.metadata.drop_all(bind=engine)
    with TestClient(main.app) as test_client:
        yield test_client
    Base.metadata.drop_all(bind=engine)


def add_product(stock=2, category="হিজাব"):
    with SessionLocal() as db:
        product = Product(
            name="Regression Test Product",
            slug="regression-test-product",
            category=category,
            description="Testing catalogue item",
            price=500,
            stock=stock,
            sizes=["ফ্রি সাইজ"],
            colors=["কালো"],
            images=[],
            active=True,
        )
        db.add(product)
        db.commit()
        db.refresh(product)
        return product.id


def login(client):
    response = client.post(
        "/api/admin/login",
        json={"access_key": os.environ["ADMIN_ACCESS_KEY"]},
    )
    assert response.status_code == 200


def create_order(client, product_id, phone="০১৭১২৩৪৫৬৭৮", quantity=1):
    return client.post(
        "/api/orders",
        json={
            "customer_name": "  পরীক্ষার গ্রাহক  ",
            "phone": phone,
            "address": "  ঢাকা, মিরপুর, রোড ১  ",
            "note": "  গেটে ফোন করবেন  ",
            "delivery_area": "outside",
            "items": [{
                "product_id": product_id,
                "quantity": quantity,
                "size": "ফ্রি সাইজ",
                "color": "কালো",
            }],
        },
    )


def test_bengali_digits_and_real_mobile_prefixes():
    assert main.normalize_bd_phone("০১৭১২৩৪৫৬৭৮") == "01712345678"
    assert main.normalize_bd_phone("+৮৮০ ১৭১২-৩৪৫৬৭৮") == "01712345678"
    with pytest.raises(ValueError):
        main.normalize_bd_phone("০১০১২৩৪৫৬৭৮")


def test_whitespace_only_name_and_address_are_rejected():
    with pytest.raises(ValidationError):
        main.OrderInput(
            customer_name="   ",
            phone="01712345678",
            address="        ",
            items=[{"product_id": 1, "quantity": 1}],
        )


def test_order_atomic_stock_update_and_private_receipt(client):
    product_id = add_product(stock=1)
    first = create_order(client, product_id)
    assert first.status_code == 200, first.text
    receipt = first.json()["order"]
    assert receipt["created_at"].endswith("Z")
    assert receipt["invoice"].startswith("RIH-")
    assert "phone" not in receipt
    assert "address" not in receipt
    assert "fraud_flag" not in receipt
    assert "fraud_reason" not in receipt

    with SessionLocal() as db:
        assert db.get(Product, product_id).stock == 0
        order = db.scalar(select(Order))
        assert order.customer_name == "পরীক্ষার গ্রাহক"
        assert order.address == "ঢাকা, মিরপুর, রোড ১"
        assert order.note == "গেটে ফোন করবেন"

    second = create_order(client, product_id, phone="01912345678")
    assert second.status_code == 409
    with SessionLocal() as db:
        assert db.get(Product, product_id).stock == 0


class FakeSteadfastSuccess:
    def raise_for_status(self):
        return None

    def json(self):
        return {
            "status": 200,
            "message": "Consignment has been created successfully.",
            "consignment": {
                "consignment_id": 1424107,
                "tracking_code": "15BAEB8A",
                "status": "in_review",
            },
        }


def test_steadfast_nested_response_timeout_guard_and_manual_retry(client, monkeypatch):
    product_id = add_product(stock=2, category="বোরকা")
    order_response = create_order(client, product_id, phone="01812345678")
    assert order_response.status_code == 200
    order_invoice = order_response.json()["order"]["invoice"]

    login(client)
    with SessionLocal() as db:
        order = db.scalar(select(Order).where(Order.invoice == order_invoice))
        order_id = order.id
    assert client.put(
        f"/api/admin/orders/{order_id}/status",
        json={"status": "confirmed"},
    ).status_code == 200

    monkeypatch.setenv("STEADFAST_API_KEY", "fake-key")
    monkeypatch.setenv("STEADFAST_SECRET_KEY", "fake-secret")

    def timeout(*args, **kwargs):
        raise requests.Timeout("simulated timeout")

    monkeypatch.setattr(main.requests, "post", timeout)
    ambiguous = client.post(f"/api/admin/orders/{order_id}/steadfast")
    assert ambiguous.status_code == 502
    with SessionLocal() as db:
        order = db.get(Order, order_id)
        assert order.courier_status == "unknown"
        assert order.courier_consignment_id == ""

    blocked_retry = client.post(f"/api/admin/orders/{order_id}/steadfast")
    assert blocked_retry.status_code == 409

    reset = client.post(f"/api/admin/orders/{order_id}/steadfast/reset")
    assert reset.status_code == 200

    monkeypatch.setattr(main.requests, "post", lambda *args, **kwargs: FakeSteadfastSuccess())
    sent = client.post(f"/api/admin/orders/{order_id}/steadfast")
    assert sent.status_code == 200, sent.text
    body = sent.json()
    assert body["courier"]["consignment_id"] == "1424107"
    assert body["courier"]["tracking_code"] == "15BAEB8A"
    assert body["order"]["status"] == "processing"

    # Even if a legacy operator manually resets status, saved courier IDs block duplicates.
    with SessionLocal() as db:
        order = db.get(Order, order_id)
        order.status = "confirmed"
        db.commit()
    duplicate = client.post(f"/api/admin/orders/{order_id}/steadfast")
    assert duplicate.status_code == 409


def test_status_machine_does_not_cancel_shipped_parcel_or_restore_stock(client):
    product_id = add_product(stock=1, category="বোরকা")
    order_response = create_order(client, product_id, phone="01912345678")
    login(client)
    invoice = order_response.json()["order"]["invoice"]
    with SessionLocal() as db:
        order = db.scalar(select(Order).where(Order.invoice == invoice))
        order_id = order.id

    for status in ["confirmed", "processing", "shipped"]:
        response = client.put(
            f"/api/admin/orders/{order_id}/status",
            json={"status": status},
        )
        assert response.status_code == 200, response.text

    cancelled = client.put(
        f"/api/admin/orders/{order_id}/status",
        json={"status": "cancelled"},
    )
    assert cancelled.status_code == 409
    with SessionLocal() as db:
        assert db.get(Product, product_id).stock == 0
        assert db.get(Order, order_id).status == "shipped"


def test_cancel_new_order_restores_stock_once(client):
    product_id = add_product(stock=1)
    order_response = create_order(client, product_id, phone="01612345678")
    login(client)
    invoice = order_response.json()["order"]["invoice"]
    with SessionLocal() as db:
        order_id = db.scalar(select(Order.id).where(Order.invoice == invoice))

    response = client.put(
        f"/api/admin/orders/{order_id}/status",
        json={"status": "cancelled"},
    )
    assert response.status_code == 200
    with SessionLocal() as db:
        assert db.get(Product, product_id).stock == 1


def test_hidden_category_hides_its_products(client):
    with SessionLocal() as db:
        db.add(Category(name="Hidden category", active=False))
        db.commit()
    product_id = add_product(stock=2, category="Hidden category")
    assert client.get("/api/products").json() == []
    product = client.get(f"/api/products/{product_id}")
    assert product.status_code == 404
    landing = client.get("/regression-test-product")
    assert landing.status_code == 404


def test_steadfast_send_is_claimed_atomically(client, monkeypatch):
    product_id = add_product(stock=1, category="বোরকা")
    order_response = create_order(client, product_id, phone="01512345678")
    assert order_response.status_code == 200
    invoice = order_response.json()["order"]["invoice"]
    login(client)
    with SessionLocal() as db:
        order_id = db.scalar(select(Order.id).where(Order.invoice == invoice))
    assert client.put(f"/api/admin/orders/{order_id}/status", json={"status": "confirmed"}).status_code == 200

    monkeypatch.setenv("STEADFAST_API_KEY", "fake-key")
    monkeypatch.setenv("STEADFAST_SECRET_KEY", "fake-secret")
    request_started = threading.Event()
    allow_response = threading.Event()
    calls = []

    def slow_post(*args, **kwargs):
        calls.append(1)
        request_started.set()
        assert allow_response.wait(timeout=5), "test did not release the simulated courier request"
        return FakeSteadfastSuccess()

    monkeypatch.setattr(main.requests, "post", slow_post)
    first_result = {}

    def send_first():
        first_result["response"] = client.post(f"/api/admin/orders/{order_id}/steadfast")

    worker = threading.Thread(target=send_first)
    worker.start()
    assert request_started.wait(timeout=5), "first courier request did not reach the mock"
    try:
        with TestClient(main.app) as second_client:
            login(second_client)
            second = second_client.post(f"/api/admin/orders/{order_id}/steadfast")
            assert second.status_code == 409, second.text
    finally:
        allow_response.set()
        worker.join(timeout=5)

    assert not worker.is_alive()
    assert first_result["response"].status_code == 200, first_result.get("response").text
    assert len(calls) == 1


def test_health_check_reaches_database(client):
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json()["database"] == "ok"


def test_production_guard_rejects_sqlite_and_missing_persistent_config(monkeypatch):
    monkeypatch.setattr(main, "production", True)
    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.setenv("DATABASE_URL", "sqlite:///./local.db")
    monkeypatch.setenv("ADMIN_ACCESS_KEY", "a-strong-admin-access-key-123")
    monkeypatch.setenv("SESSION_SECRET", "this-is-a-long-random-session-secret-value-123456")
    monkeypatch.setenv("PUBLIC_SITE_URL", "https://riham.example")
    monkeypatch.setenv("COOKIE_SECURE", "true")
    with pytest.raises(RuntimeError, match="persistent PostgreSQL"):
        main.check_secrets()


def test_startup_migration_does_not_overwrite_custom_photo_theme(client):
    with SessionLocal() as db:
        config = SiteConfig(id=1, store_name="RIHAM", theme="photo")
        db.add(config)
        db.commit()
    main.migrate_v4()
    with SessionLocal() as db:
        assert db.get(SiteConfig, 1).theme == "photo"


def test_hidden_category_product_cannot_be_ordered_by_direct_api(client):
    with SessionLocal() as db:
        db.add(Category(name="Hidden direct order", active=False))
        db.commit()
    product_id = add_product(stock=3, category="Hidden direct order")
    response = create_order(client, product_id, phone="01712345679")
    assert response.status_code == 400
    with SessionLocal() as db:
        assert db.get(Product, product_id).stock == 3


def test_repeated_cancel_does_not_restore_stock_twice(client):
    product_id = add_product(stock=2)
    response = create_order(client, product_id, phone="01712345671")
    login(client)
    invoice = response.json()["order"]["invoice"]
    with SessionLocal() as db:
        order_id = db.scalar(select(Order.id).where(Order.invoice == invoice))
    first = client.put(f"/api/admin/orders/{order_id}/status", json={"status": "cancelled"})
    second = client.put(f"/api/admin/orders/{order_id}/status", json={"status": "cancelled"})
    assert first.status_code == 200
    assert second.status_code == 200
    with SessionLocal() as db:
        assert db.get(Product, product_id).stock == 2


def test_store_name_whitespace_is_rejected():
    with pytest.raises(ValidationError):
        main.SettingsInput(store_name="   ")


def test_metadata_descriptions_are_short_and_static_assets_revalidate(client):
    with SessionLocal() as db:
        cfg = db.get(SiteConfig, 1)
        if cfg is None:
            cfg = SiteConfig(id=1)
            db.add(cfg)
        cfg.seo_description = "বর্ণনা " * 100
        db.commit()
    home = client.get("/")
    import re
    meta = re.search(r'<meta name="description" content="([^"]*)"', home.text)
    assert meta and len(meta.group(1)) <= 160
    static = client.get("/static/app.js")
    assert static.status_code == 200
    assert static.headers.get("cache-control") == "public, max-age=0, must-revalidate"


def test_steadfast_success_without_tracking_id_is_ambiguous_not_retryable(client, monkeypatch):
    product_id = add_product(stock=2, category="বোরকা")
    order_response = create_order(client, product_id, phone="01812345670")
    invoice = order_response.json()["order"]["invoice"]
    login(client)
    with SessionLocal() as db:
        order_id = db.scalar(select(Order.id).where(Order.invoice == invoice))
    assert client.put(f"/api/admin/orders/{order_id}/status", json={"status": "confirmed"}).status_code == 200
    monkeypatch.setenv("STEADFAST_API_KEY", "fake-key")
    monkeypatch.setenv("STEADFAST_SECRET_KEY", "fake-secret")

    class MissingTracking:
        def raise_for_status(self):
            return None
        def json(self):
            return {"status": 200, "message": "created", "consignment": {}}

    monkeypatch.setattr(main.requests, "post", lambda *args, **kwargs: MissingTracking())
    failed = client.post(f"/api/admin/orders/{order_id}/steadfast")
    assert failed.status_code == 502
    with SessionLocal() as db:
        assert db.get(Order, order_id).courier_status == "unknown"
    blocked = client.post(f"/api/admin/orders/{order_id}/steadfast")
    assert blocked.status_code == 409
