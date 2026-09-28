"""数据服务层：启动时全量加载 data/problems/*.json 进内存，提供查询/聚合。"""
import json
import re
from pathlib import Path

DATA_DIR = Path(__file__).resolve().parent.parent / "data"
PROBLEMS_DIR = DATA_DIR / "problems"

# 分类中文名与展示顺序（17 个官方专题）
CATEGORIES = [
    {"id": "hash", "name": "哈希"},
    {"id": "two-pointers", "name": "双指针"},
    {"id": "sliding-window", "name": "滑动窗口"},
    {"id": "substring", "name": "子串"},
    {"id": "array", "name": "普通数组"},
    {"id": "matrix", "name": "矩阵"},
    {"id": "linked-list", "name": "链表"},
    {"id": "binary-tree", "name": "二叉树"},
    {"id": "graph", "name": "图论"},
    {"id": "backtracking", "name": "回溯"},
    {"id": "binary-search", "name": "二分查找"},
    {"id": "stack", "name": "栈"},
    {"id": "heap", "name": "堆"},
    {"id": "greedy", "name": "贪心算法"},
    {"id": "dp", "name": "动态规划"},
    {"id": "multi-dp", "name": "多维动态规划"},
    {"id": "techniques", "name": "技巧"},
]

_cache: dict | None = None


def _load_all() -> dict:
    """扫描 problems/*.json，聚合出 {problems, by_id, by_category}。"""
    problems: list[dict] = []
    for path in sorted(PROBLEMS_DIR.glob("*.json")):
        with open(path, encoding="utf-8") as f:
            payload = json.load(f)
        problems.extend(payload.get("problems", []))

    problems.sort(key=lambda p: (p.get("num", 0),))
    by_id = {p["id"]: p for p in problems}
    by_cat: dict[str, list[dict]] = {c["id"]: [] for c in CATEGORIES}
    for p in problems:
        cat = p.get("category")
        if cat in by_cat:
            by_cat[cat].append(p)

    return {"problems": problems, "by_id": by_id, "by_category": by_cat}


def _get() -> dict:
    global _cache
    if _cache is None:
        _cache = _load_all()
    return _cache


def reload() -> None:  # 供工具/测试重载
    global _cache
    _cache = _load_all()


def health() -> dict:
    d = _get()
    return {"status": "ok", "problems": len(d["problems"]), "categories": len(CATEGORIES)}


def catalog() -> dict:
    """列表页一次拉全：17 分类 + 每题元数据（不含正文与 anim）。"""
    d = _get()
    cats = []
    for order, c in enumerate(CATEGORIES):
        plist = d["by_category"].get(c["id"], [])
        cats.append({
            "id": c["id"],
            "name": c["name"],
            "order": order,
            "count": len(plist),
            "problems": [_meta(p) for p in plist],
        })
    return {"categories": cats, "total": len(d["problems"])}


def _meta(p: dict) -> dict:
    return {
        "id": p["id"], "num": p["num"], "leet_id": p["leet_id"],
        "title_cn": p["title_cn"], "title_en": p["title_en"],
        "difficulty": p["difficulty"], "category": p["category"],
        "tags": p.get("tags", []),
    }


def list_problems(difficulty: str | None = None, category: str | None = None, q: str | None = None) -> list[dict]:
    d = _get()
    out = []
    for p in d["problems"]:
        if difficulty and p["difficulty"] != difficulty:
            continue
        if category and p["category"] != category:
            continue
        if q:
            kw = q.lower()
            hay = f'{p["num"]} {p["leet_id"]} {p["title_cn"]} {p["title_en"]}'.lower()
            if kw not in hay:
                continue
        out.append(_meta(p))
    return out


def get_problem(pid: str) -> dict | None:
    return _get()["by_id"].get(pid)


def stats() -> dict:
    d = _get()
    by_diff = {"简单": 0, "中等": 0, "困难": 0}
    for p in d["problems"]:
        by_diff[p["difficulty"]] = by_diff.get(p["difficulty"], 0) + 1
    return {
        "total": len(d["problems"]),
        "byDifficulty": by_diff,
        "byCategory": {c["id"]: len(d["by_category"].get(c["id"], [])) for c in CATEGORIES},
    }
