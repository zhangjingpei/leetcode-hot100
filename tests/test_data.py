# -*- coding: utf-8 -*-
"""数据完整性测试：100 题、字段齐全、ID 唯一、anim 结构合法。"""
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PROBLEMS_DIR = ROOT / "data" / "problems"

CATEGORY_FILES = [
    "01-hash", "02-two-pointers", "03-sliding-window", "04-substring",
    "05-array", "06-matrix", "07-linked-list", "08-binary-tree",
    "09-graph", "10-backtracking", "11-binary-search", "12-stack",
    "13-heap", "14-greedy", "15-dp", "16-multi-dp", "17-techniques",
]

REQUIRED_KEYS = {
    "id", "num", "leet_id", "title_cn", "title_en", "difficulty",
    "category", "tags", "statement", "solution", "anim",
}


def _all_problems():
    problems = []
    for path in sorted(PROBLEMS_DIR.glob("*.json")):
        payload = json.loads(path.read_text(encoding="utf-8"))
        problems.extend(payload["problems"])
    return problems


def test_17_category_files_exist():
    for name in CATEGORY_FILES:
        assert (PROBLEMS_DIR / f"{name}.json").exists(), f"缺少 {name}.json"


def test_total_is_100():
    assert len(_all_problems()) == 100


def test_ids_unique_and_num_sequential_per_category():
    problems = _all_problems()
    ids = [p["id"] for p in problems]
    assert len(ids) == len(set(ids)), "存在重复 id"
    leet_ids = [p["leet_id"] for p in problems]
    assert len(leet_ids) == len(set(leet_ids)), "存在重复 leet_id"
    # num 为分类内序号：每个分类内 1..count 连续
    by_cat = {}
    for p in problems:
        by_cat.setdefault(p["category"], []).append(p["num"])
    for cat, nums in by_cat.items():
        assert sorted(nums) == list(range(1, len(nums) + 1)), f"分类 {cat} 的 num 不连续"


def test_each_problem_has_required_fields():
    for p in _all_problems():
        missing = REQUIRED_KEYS - set(p)
        assert not missing, f'{p["id"]} 缺字段: {missing}'


def test_statement_structure():
    for p in _all_problems():
        st = p["statement"]
        assert st.get("desc"), f'{p["id"]} 无题意描述'
        assert st.get("examples"), f'{p["id"]} 无示例'
        for ex in st["examples"]:
            assert "input" in ex and "output" in ex, f'{p["id"]} 示例缺 input/output'


def test_solution_structure():
    for p in _all_problems():
        sol = p["solution"]
        assert sol.get("idea"), f'{p["id"]} 无思路'
        assert sol.get("steps"), f'{p["id"]} 无步骤'
        cx = sol.get("complexity", {})
        assert cx.get("time") and cx.get("space"), f'{p["id"]} 复杂度不全'
        code = sol.get("code", "")
        assert "def " in code, f'{p["id"]} 题解代码无函数定义'


def test_anim_structure():
    for p in _all_problems():
        anim = p["anim"]
        views, frames = anim.get("views"), anim.get("frames")
        assert views, f'{p["id"]} 无 views'
        assert frames, f'{p["id"]} 无 frames'
        view_ids = {v["id"] for v in views}
        assert len(view_ids) == len(views), f'{p["id"]} view id 重复'
        for i, f in enumerate(frames):
            assert f.get("say"), f'{p["id"]} 帧 {i} 无解说'
            refs = set((f.get("set") or {})) | set((f.get("add") or {})) \
                | set((f.get("del") or {})) | set((f.get("swap") or {})) \
                | set((f.get("hl") or {})) | set((f.get("ptr") or {}))
            unknown = refs - view_ids
            assert not unknown, f'{p["id"]} 帧 {i} 引用未定义 view: {unknown}'


def test_difficulty_valid():
    for p in _all_problems():
        assert p["difficulty"] in ("简单", "中等", "困难"), f'{p["id"]} 难度非法'


def test_category_matches_file():
    for path in sorted(PROBLEMS_DIR.glob("*.json")):
        expect = path.stem.split("-", 1)[1]
        for p in json.loads(path.read_text(encoding="utf-8"))["problems"]:
            assert p["category"] == expect, f'{p["id"]} 分类 {p["category"]} != 文件 {expect}'
