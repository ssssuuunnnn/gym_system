"""
平台形象頁的 SEO（ADR 0017）：結構化資料、分享預覽、可快取的 HTML、sitemap lastmod，
以及 LANDING_ON_APEX 開啟時形象頁搬到主網域、平台網址只剩管理後台。
"""

import json
import re

import pytest
from fastapi.testclient import TestClient

from app.core.config import settings
from app.main import app


def _json_ld(html: str) -> dict:
    match = re.search(r'<script type="application/ld\+json">(.*?)</script>', html, re.S)
    assert match, "形象頁沒有 JSON-LD"
    return json.loads(match.group(1))


@pytest.fixture()
def apex_mode(monkeypatch):
    monkeypatch.setattr(settings, "LANDING_ON_APEX", True)


@pytest.fixture()
def apex_client(platform_connection, apex_mode):
    """主網域（測試環境的 BASE_DOMAIN＝localhost）。"""
    return TestClient(app, base_url="http://localhost")


# ---------- 中繼資料 ----------


def test_landing_metadata_and_structured_data(platform_client):
    res = platform_client.get("/")
    assert res.status_code == 200
    assert res.headers["cache-control"] == "public, max-age=300"
    html = res.text
    assert "線上預約系統" in html.split("</title>")[0]
    assert '<link rel="canonical" href="http://platform.localhost/">' in html
    assert '<meta property="og:image" content="http://platform.localhost/site/static/brand/og-image.png">' in html
    assert '<meta name="twitter:card" content="summary_large_image">' in html
    assert 'rel="apple-touch-icon"' in html and "/site/static/brand/favicon.svg" in html

    graph = {node["@type"]: node for node in _json_ld(html)["@graph"]}
    assert set(graph) == {"Organization", "WebSite", "SoftwareApplication", "FAQPage"}
    assert graph["SoftwareApplication"]["offers"]["price"] == "0"
    faq = graph["FAQPage"]["mainEntity"]
    assert len(faq) == 5
    # 頁面上的常見問題與結構化資料是同一份
    for item in faq:
        assert item["name"] in html and item["acceptedAnswer"]["text"] in html


def test_brand_assets_are_served(platform_client):
    for name in ("og-image.png", "favicon.svg", "favicon-32.png", "apple-touch-icon.png", "icon-512.png", "logo.svg", "logo-dark.svg"):
        assert platform_client.get(f"/site/static/brand/{name}").status_code == 200, name


def test_terms_has_its_own_canonical(platform_client):
    html = platform_client.get("/site/terms").text
    assert '<link rel="canonical" href="http://platform.localhost/site/terms">' in html


def test_form_errors_are_not_cached(platform_client):
    res = platform_client.post("/site/signup", data={"store_name": ""})
    assert res.status_code == 400
    assert res.headers["cache-control"] == "no-store"


def test_sitemap_has_lastmod(platform_client):
    body = platform_client.get("/sitemap.xml").text
    assert body.count("<lastmod>") == 2


def test_check_subdomain_on_landing_host(platform_client, client):
    res = platform_client.get("/site/check-subdomain", params={"subdomain": "alpha"})
    assert res.status_code == 200 and res.json()["available"] is False
    res = platform_client.get("/site/check-subdomain", params={"subdomain": "Brand-New-Shop"})
    assert res.json() == {"subdomain": "brand-new-shop", "available": True, "reason": None}
    # 店家網址沒有這個檢查
    assert client.get("/site/check-subdomain", params={"subdomain": "x"}).status_code == 404


# ---------- 形象頁在主網域（LANDING_ON_APEX） ----------


def test_apex_serves_landing(apex_client):
    res = apex_client.get("/")
    assert res.status_code == 200 and 'action="/site/signup"' in res.text
    assert '<link rel="canonical" href="http://localhost/">' in res.text
    assert "fetch('/site/check-subdomain?subdomain='" in res.text
    assert apex_client.get("/site/terms").status_code == 200
    assert apex_client.get("/site/check-subdomain", params={"subdomain": "alpha"}).json()["available"] is False

    robots = apex_client.get("/robots.txt").text
    assert "Allow: /$" in robots and "Sitemap: http://localhost/sitemap.xml" in robots
    assert "<loc>http://localhost/</loc>" in apex_client.get("/sitemap.xml").text


def test_platform_host_redirects_to_apex(apex_client, platform_client):
    res = platform_client.get("/", follow_redirects=False)
    assert res.status_code == 301 and res.headers["location"] == "https://localhost/"
    res = platform_client.get("/site/terms?from=old", follow_redirects=False)
    assert res.status_code == 301 and res.headers["location"] == "https://localhost/site/terms?from=old"
    # 舊頁面送出的申請：307 保留 POST
    res = platform_client.post("/site/signup", data={"store_name": "x"}, follow_redirects=False)
    assert res.status_code == 307 and res.headers["location"] == "https://localhost/site/signup"

    # 平台網址只剩管理後台：不給搜尋引擎、沒有 sitemap
    assert platform_client.get("/robots.txt").text == "User-agent: *\nDisallow: /\n"
    assert platform_client.get("/sitemap.xml").status_code == 404


def test_gym_hosts_unchanged_in_apex_mode(apex_mode, client):
    assert client.get("/", follow_redirects=False).status_code in (302, 303)
    assert client.get("/site/terms").status_code == 404
    assert client.post("/site/signup", data={"store_name": "x"}).status_code == 404


# ---------- Google 代碼管理工具（只在平台形象頁） ----------


def test_gtm_only_when_configured(platform_client, client, monkeypatch, admin):
    assert "googletagmanager" not in platform_client.get("/").text

    monkeypatch.setattr(settings, "GTM_ID", "GTM-P57ZQDMK")
    html = platform_client.get("/").text
    assert "'dataLayer','GTM-P57ZQDMK'" in html
    assert "ns.html?id=GTM-P57ZQDMK" in html
    terms = platform_client.get("/site/terms").text
    assert "googletagmanager" in terms and "網站使用分析" in terms

    # 店家網址（形象網站、登入頁）不載入平台的追蹤碼
    assert "googletagmanager" not in client.get("/", follow_redirects=True).text


def test_gtm_rejects_malformed_id(platform_client, monkeypatch):
    monkeypatch.setattr(settings, "GTM_ID", "GTM-X');alert(1)//")
    html = platform_client.get("/").text
    assert "googletagmanager" not in html and "alert(1)" not in html
