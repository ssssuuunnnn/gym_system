"""
最新消息與會員標籤（ADR 0012、R50–R52）：
標籤管理與貼標籤、會員列表／會員名單依標籤篩選、標籤不給會員看；
最新消息的發布與形象網站呈現；用 LINE 發給「標籤 ∪ 會員名單條件」裡同意優惠訊息的會員，不重複發送。
"""

import pytest

from app.models.line import LineNotificationStatus
from app.models.line_oa import LineMemberEvent, LineMemberMessage
from app.models.user import StaffLevel, UserRole
from app.services import news as news_service
from tests.conftest import auth
from tests.test_line_oa import enabled, fake_oa  # noqa: F401  （共用 fixture）
from tests.test_member_segments import PERIOD, fixed_today, gym, make_member  # noqa: F401

API = "/api/v1"


@pytest.fixture()
def sent(monkeypatch, enabled):  # noqa: F811
    """回應後的發送改成測試呼叫 run() 才送（同 test_line_member.pushes）。"""
    from app.core.tenant_context import current_tenant

    scheduled = []

    def schedule(background_tasks, ids):
        if ids:
            scheduled.append((current_tenant.get().id, list(ids)))

    def run():
        while scheduled:
            tenant_id, ids = scheduled.pop(0)
            news_service.dispatch_all(tenant_id, ids)
        return enabled.pushes

    monkeypatch.setattr(news_service, "schedule", schedule)
    enabled.run = run
    return enabled


def publish_site(client, admin):
    client.get(f"{API}/website", headers=auth(admin))
    assert client.post(f"{API}/website/publish", headers=auth(admin)).status_code == 200


def create_news(client, admin, **fields):
    body = {"title": "十一月公休公告", "summary": "11/15 全館公休一天", "body": "第一行\n第二行", "is_published": True}
    body.update(fields)
    res = client.post(f"{API}/news", json=body, headers=auth(admin))
    assert res.status_code == 201, res.text
    return res.json()


def create_tag(client, admin, name, color="blue"):
    res = client.post(f"{API}/member-tags", json={"name": name, "color": color}, headers=auth(admin))
    assert res.status_code == 201, res.text
    return res.json()


# ---------- 會員標籤 ----------


def test_tags_on_members(client, admin, db, member):
    vip = create_tag(client, admin, "VIP", "gold")
    early = create_tag(client, admin, "早鳥班")
    assert client.post(f"{API}/member-tags", json={"name": "VIP"}, headers=auth(admin)).status_code == 409

    res = client.put(f"{API}/users/{member.id}/tags", json={"tag_ids": [vip["id"], early["id"]]}, headers=auth(admin))
    assert res.status_code == 200 and sorted(res.json()["tag_ids"]) == sorted([vip["id"], early["id"]])
    listed = {u["id"]: u for u in client.get(f"{API}/users", headers=auth(admin)).json()}
    assert sorted(listed[member.id]["tag_ids"]) == sorted([vip["id"], early["id"]])
    tags = {t["name"]: t for t in client.get(f"{API}/member-tags", headers=auth(admin)).json()}
    assert tags["VIP"]["member_count"] == 1 and tags["VIP"]["sendable_count"] == 0

    # 會員自己看不到標籤
    assert client.get(f"{API}/auth/me", headers=auth(member)).json()["tag_ids"] == []
    assert client.get(f"{API}/member-tags", headers=auth(member)).status_code == 403

    # 整組取代；刪除標籤也從會員身上拿掉
    client.put(f"{API}/users/{member.id}/tags", json={"tag_ids": [vip["id"]]}, headers=auth(admin))
    assert client.delete(f"{API}/member-tags/{vip['id']}", headers=auth(admin)).status_code == 204
    assert client.get(f"{API}/users/{member.id}", headers=auth(admin)).json()["tag_ids"] == []
    assert client.put(f"{API}/users/{member.id}/tags", json={"tag_ids": [vip["id"]]},
                      headers=auth(admin)).status_code == 400


def test_segment_filter_by_tag_and_bulk_tagging(client, admin, gym):  # noqa: F811
    vip = create_tag(client, admin, "VIP")
    body = {**PERIOD}
    everyone = client.post(f"{API}/member-segments/preview", json=body, headers=auth(admin)).json()
    ids = [m["id"] for m in everyone["members"]]
    assert len(ids) >= 2
    # 會員名單篩出來的人一次加上標籤
    res = client.post(f"{API}/member-tags/{vip['id']}/members", json={"user_ids": ids[:1] + [admin.id]},
                      headers=auth(admin))
    assert res.json()["member_count"] == 1  # 管理員帳號不會被貼上
    tagged = client.post(f"{API}/member-segments/preview", json={**body, "tag_ids": [vip["id"]]},
                         headers=auth(admin)).json()
    assert [m["id"] for m in tagged["members"]] == ids[:1]
    assert tagged["members"][0]["tag_ids"] == [vip["id"]]


# ---------- 最新消息與形象網站 ----------


def test_news_on_website(client, admin, db, tenants):
    publish_site(client, admin)
    draft = create_news(client, admin, title="草稿消息", is_published=False)
    post = create_news(client, admin)
    assert post["published_at"] and post["path"] == f"/site/news/{post['id']}"

    html = client.get("/").text
    assert 'id="news"' in html and "十一月公休公告" in html and "草稿消息" not in html
    assert f'href="/site/news/{post["id"]}"' in html

    page = client.get(f"/site/news/{post['id']}")
    assert page.status_code == 200
    assert "<title>十一月公休公告｜" in page.text and "第一行\n第二行" in page.text
    assert '"@type": "NewsArticle"' in page.text and 'href="/#' in page.text
    assert client.get(f"/site/news/{draft['id']}").status_code == 404
    # 預覽連結看得到草稿
    token = client.post(f"{API}/website/preview-token", headers=auth(admin)).json()["token"]
    assert client.get(f"/site/news/{draft['id']}?token={token}").status_code == 200

    index = client.get("/site/news").text
    assert "十一月公休公告" in index and "草稿消息" not in index
    sitemap = client.get("/sitemap.xml").text
    assert f"/site/news/{post['id']}</loc>" in sitemap and f"/site/news/{draft['id']}<" not in sitemap
    assert "Allow: /site/news" in client.get("/robots.txt").text

    # 取消發布就從網站消失；首頁段落沒有消息時自動隱藏
    client.put(f"{API}/news/{post['id']}", json={**post, "is_published": False}, headers=auth(admin))
    assert client.get(f"/site/news/{post['id']}").status_code == 404
    assert 'id="news"' not in client.get("/").text

    bad = {"title": "x", "image_url": "/media/beta/site/" + "a" * 32 + ".jpg"}
    assert client.post(f"{API}/news", json=bad, headers=auth(admin)).status_code == 400


def test_news_permissions(client, db, member):
    staff = make_member(db, "desk", role=UserRole.admin)
    staff.staff_level = StaffLevel.staff
    staff.permissions = ["website"]
    db.commit()
    post = create_news(client, staff)
    # 只有形象網站權限：可以編輯消息，但不能用 LINE 發送
    res = client.post(f"{API}/news/{post['id']}/broadcast/preview", json={"tag_ids": []}, headers=auth(staff))
    assert res.status_code == 403
    assert client.get(f"{API}/news", headers=auth(member)).status_code == 403


# ---------- LINE 發送 ----------


def test_broadcast_to_tags_and_segment(client, admin, db, gym, sent):  # noqa: F811
    publish_site(client, admin)
    post = create_news(client, admin)
    vip = create_tag(client, admin, "VIP")
    fay = make_member(db, "fay", name="Fay", line="U-fay", consent=True)  # 只在標籤裡
    gus = make_member(db, "gus", name="Gus", line="U-gus")  # 標籤裡但沒同意優惠訊息
    client.post(f"{API}/member-tags/{vip['id']}/members", json={"user_ids": [fay.id, gus.id, gym["amy"].id]},
                headers=auth(admin))

    target = {"tag_ids": [vip["id"]], "filters": PERIOD}
    preview = client.post(f"{API}/news/{post['id']}/broadcast/preview", json=target, headers=auth(admin)).json()
    # 標籤：Fay、Gus、Amy；名單：Amy、Ben、Cat → 聯集 5 人，可發送 Fay、Amy
    assert preview["total"] == 5 and preview["sendable"] == 2 and preview["to_send"] == 2
    assert preview["no_consent"] == 2 and preview["no_line"] == 1 and preview["problems"] == []

    res = client.post(f"{API}/news/{post['id']}/broadcast", json=target, headers=auth(admin))
    assert res.status_code == 201 and res.json()["queued"] == 2
    pushes = sent.run()
    assert sorted(to for to, _ in pushes) == ["U-amy", "U-fay"]
    card = pushes[0][1][0]
    assert card["type"] == "flex" and "十一月公休公告" in card["altText"]
    assert card["contents"]["footer"]["contents"][0]["action"]["uri"].endswith(f"/site/news/{post['id']}")

    # 再發一次不會重複
    again = client.post(f"{API}/news/{post['id']}/broadcast/preview", json=target, headers=auth(admin)).json()
    assert again["already_sent"] == 2 and again["to_send"] == 0 and again["problems"]
    assert client.post(f"{API}/news/{post['id']}/broadcast", json=target, headers=auth(admin)).status_code == 400

    history = client.get(f"{API}/news/{post['id']}/broadcasts", headers=auth(admin)).json()
    assert history["delivery"]["sent"] == 2 and len(history["items"]) == 1
    assert "VIP" in history["items"][0]["target_label"] and "會員名單" in history["items"][0]["target_label"]
    listed = client.get(f"{API}/news", headers=auth(admin)).json()[0]
    assert listed["broadcast_count"] == 1


def test_broadcast_requires_published_and_respects_consent_at_send_time(client, admin, db, sent):
    vip = create_tag(client, admin, "VIP")
    fay = make_member(db, "fay", line="U-fay", consent=True)
    client.post(f"{API}/member-tags/{vip['id']}/members", json={"user_ids": [fay.id]}, headers=auth(admin))
    post = create_news(client, admin)
    target = {"tag_ids": [vip["id"]]}

    # 網站還沒發布：會員點開會看不到 → 不能發
    preview = client.post(f"{API}/news/{post['id']}/broadcast/preview", json=target, headers=auth(admin)).json()
    assert any("形象網站" in p for p in preview["problems"])
    assert client.post(f"{API}/news/{post['id']}/broadcast", json=target, headers=auth(admin)).status_code == 400

    publish_site(client, admin)
    assert client.post(f"{API}/news/{post['id']}/broadcast", json=target, headers=auth(admin)).status_code == 201
    # 送出前會員取消同意優惠訊息：略過不發
    fay.marketing_consent_at = None
    db.commit()
    assert sent.run() == []
    row = db.query(LineMemberMessage).filter(LineMemberMessage.event == LineMemberEvent.news).one()
    assert row.status == LineNotificationStatus.skipped_disabled and row.message is None


def test_broadcast_without_line_oa(client, admin, db):
    publish_site(client, admin)
    post = create_news(client, admin)
    vip = create_tag(client, admin, "VIP")
    res = client.post(f"{API}/news/{post['id']}/broadcast/preview", json={"tag_ids": [vip["id"]]},
                      headers=auth(admin)).json()
    assert res["oa_enabled"] is False and any("LINE 官方帳號" in p for p in res["problems"])
