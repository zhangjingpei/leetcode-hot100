# -*- coding: utf-8 -*-
"""API 集成测试：基于 FastAPI TestClient 走真实路由。"""
import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT))

from app.main import app  # noqa: E402


@pytest.fixture(scope="module")
def client():
    with TestClient(app) as c:
        yield c


def test_health(client):
    r = client.get("/api/health")
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "ok"
    assert body["problems"] == 100
    assert body["categories"] == 17


def test_catalog(client):
    r = client.get("/api/catalog")
    assert r.status_code == 200
    body = r.json()
    assert body["total"] == 100
    assert len(body["categories"]) == 17
    assert sum(c["count"] for c in body["categories"]) == 100
    for c in body["categories"]:
        assert c["count"] == len(c["problems"])


def test_problems_list_and_filters(client):
    r = client.get("/api/problems")
    assert r.status_code == 200
    assert len(r.json()) == 100

    r = client.get("/api/problems", params={"difficulty": "困难"})
    assert all(p["difficulty"] == "困难" for p in r.json())
    assert 0 < len(r.json()) < 100

    r = client.get("/api/problems", params={"category": "dp"})
    assert all(p["category"] == "dp" for p in r.json())
    assert len(r.json()) == 10

    r = client.get("/api/problems", params={"q": "两数"})
    titles = [p["title_cn"] for p in r.json()]
    assert any("两数" in t for t in titles)

    r = client.get("/api/problems", params={"q": "no-such-keyword-xyz"})
    assert r.json() == []


def test_problem_detail(client):
    r = client.get("/api/problems/two-sum")
    assert r.status_code == 200
    body = r.json()
    assert body["leet_id"] == 1
    assert body["solution"]["code"]
    assert body["anim"]["frames"]

    r = client.get("/api/problems/definitely-not-exist")
    assert r.status_code == 404


def test_stats(client):
    r = client.get("/api/stats")
    assert r.status_code == 200
    body = r.json()
    assert body["total"] == 100
    assert sum(body["byDifficulty"].values()) == 100
    assert sum(body["byCategory"].values()) == 100


def test_pages_served(client):
    r = client.get("/")
    assert r.status_code == 200
    assert "Hot 100" in r.text
    # 详情页为 JS 动态渲染骨架，静态断言 title 与挂载点
    r = client.get("/problem/two-sum")
    assert r.status_code == 200
    assert "题目详情" in r.text
    assert 'id="detail"' in r.text
