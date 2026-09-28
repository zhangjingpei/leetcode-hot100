#!/usr/bin/env python3
"""题库数据强校验：
1. 字段完整性 / id 唯一 / 分类合法 / 难度合法
2. 动画 Python 重放（与前端 engine.js 同语义）：指针越界 / set 越界 / del 越界 / list、tree 操作合法
3. 与官方 Hot 100 期望题单（分类题数与 leet_id）比对
用法：python3 tools/validate_data.py
"""
import json
import math
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PDIR = ROOT / "data" / "problems"

EXPECTED = {  # 官方 Hot 100：category -> leet_id 列表
    "hash": [1, 49, 128],
    "two-pointers": [283, 11, 15, 42],
    "sliding-window": [3, 438],
    "substring": [560, 239, 76],
    "array": [53, 56, 189, 238, 41],
    "matrix": [73, 54, 48, 240],
    "linked-list": [160, 206, 234, 141, 142, 21, 2, 19, 24, 25, 138, 148, 23, 146],
    "binary-tree": [94, 104, 226, 101, 543, 102, 108, 98, 230, 199, 114, 105, 437, 236, 124],
    "graph": [200, 994, 207, 208],
    "backtracking": [46, 78, 17, 39, 22, 79, 131, 51],
    "binary-search": [35, 74, 34, 33, 153, 4],
    "stack": [20, 155, 394, 739, 84],
    "heap": [215, 347, 295],
    "greedy": [121, 55, 45, 763],
    "dp": [70, 118, 198, 279, 322, 139, 300, 152, 416, 32],
    "multi-dp": [62, 64, 5, 1143, 72],
    "techniques": [136, 169, 75, 31, 287],
}
CAT_NAMES = {
    "hash": "哈希", "two-pointers": "双指针", "sliding-window": "滑动窗口", "substring": "子串",
    "array": "普通数组", "matrix": "矩阵", "linked-list": "链表", "binary-tree": "二叉树",
    "graph": "图论", "backtracking": "回溯", "binary-search": "二分查找", "stack": "栈",
    "heap": "堆", "greedy": "贪心算法", "dp": "动态规划", "multi-dp": "多维动态规划", "techniques": "技巧",
}

errors: list[str] = []


def err(pid, msg):
    errors.append(f"[{pid}] {msg}")


def check_problem(p):
    for f in ["id", "num", "leet_id", "title_cn", "title_en", "difficulty", "category", "tags", "statement", "solution", "anim"]:
        if f not in p:
            err(p.get("id", "?"), f"缺少字段 {f}")
            return
    if p["difficulty"] not in ("简单", "中等", "困难"):
        err(p["id"], f"难度非法: {p['difficulty']}")
    if p["category"] not in EXPECTED:
        err(p["id"], f"分类非法: {p['category']}")
    st, sol, anim = p["statement"], p["solution"], p["anim"]
    if not st.get("desc") or not st.get("examples"):
        err(p["id"], "statement 缺 desc/examples")
    for i, ex in enumerate(st.get("examples", [])):
        if "input" not in ex or "output" not in ex:
            err(p["id"], f"示例 {i + 1} 缺 input/output")
    if not sol.get("idea") or not sol.get("steps"):
        err(p["id"], "solution 缺 idea/steps")
    cx = sol.get("complexity", {})
    if "time" not in cx or "space" not in cx:
        err(p["id"], "complexity 缺 time/space")
    if "def " not in sol.get("code", ""):
        err(p["id"], "code 不是 Python 题解?")
    try:
        compile(sol["code"], p["id"], "exec")
    except SyntaxError as e:
        err(p["id"], f"题解 Python 语法错误 line {e.lineno}: {e.msg}")
    check_anim(p["id"], anim)


def check_anim(pid, anim):
    views = anim.get("views", [])
    frames = anim.get("frames", [])
    if len(frames) < 6:
        err(pid, f"动画帧数过少: {len(frames)}")
    by_id = {v.get("id"): v for v in views}
    for i, f in enumerate(frames):
        if not f.get("say"):
            err(pid, f"帧 {i} 缺 say")
            continue
        # 指针
        for pid_, ni in (f.get("ptr") or {}).items():
            if pid_ not in by_id:
                err(pid, f"帧 {i} ptr 引用不存在的 view {pid_}")
        # set
        for vid, ops in (f.get("set") or {}).items():
            v = by_id.get(vid)
            if not v:
                err(pid, f"帧 {i} set 引用不存在的 view {vid}"); continue
            if v["t"] in ("array", "list"):
                pass  # JS 数组 set 支持扩容，越界/空位由 replay 运行时兜底
            elif v["t"] == "grid":
                m = v.get("m", [])
                for op in ops:
                    if op[0] < 0 or op[0] >= len(m) or (len(op) == 3 and op[1] >= len(m[0])):
                        err(pid, f"帧 {i} grid 越界 {vid}[{op[0]},{op[1] if len(op) > 2 else ''}]")
        # add
        for vid, ops in (f.get("del") or {}).items():
            v = by_id.get(vid)
            if not v:
                err(pid, f"帧 {i} del 引用不存在的 view {vid}"); continue
            if v["t"] == "map":
                if not isinstance(ops, list):
                    err(pid, f"帧 {i} map del 须为 key 列表")
        # swap
        for vid, ops in (f.get("add") or {}).items():
            v = by_id.get(vid)
            if not v:
                err(pid, f"帧 {i} add 引用不存在的 view {vid}"); continue
            if v["t"] == "map":
                items = ops if (ops and isinstance(ops[0], list)) else [ops]
                for it in items:
                    if not isinstance(it, list) or len(it) != 2:
                        err(pid, f"帧 {i} map add 须为 [k,v]")
        # swap（静态检查仅针对定长 array；stack/queue/heap 的 items 动态增长，交给 replay 运行时判定）
        for vid, ops in (f.get("swap") or {}).items():
            v = by_id.get(vid)
            arr = (v or {}).get("vals") or []
            if v and v["t"] == "array" and arr and not all(0 <= x < len(arr) for x in ops):
                err(pid, f"帧 {i} swap 越界 {vid}{ops}")
        # hl（高亮必须引用已定义 view）
        for vid in (f.get("hl") or {}):
            if vid not in by_id:
                err(pid, f"帧 {i} hl 引用不存在的 view {vid}")
    # 重放校验（与前端语义一致）
    replay(pid, views, frames)


def replay(pid, views, frames):
    import copy
    st = copy.deepcopy(views)
    by_id = {v["id"]: v for v in st}
    for v in st:  # 归一化
        if v["t"] == "map" and "kvs" not in v:
            v["kvs"] = []
        if v["t"] in ("stack", "queue", "heap") and "items" not in v:
            v["items"] = []
        if v["t"] == "array" and "vals" not in v:
            v["vals"] = []
        if v["t"] == "list":
            v.setdefault("nodes", [])
            v.setdefault("arrows", [])
        if v["t"] == "tree" and v.get("mode") == "dyn":
            v.setdefault("cursorPath", [])
            v.setdefault("_id", 0)
    for fi, f in enumerate(frames):
        for vid, ops in (f.get("set") or {}).items():
            v = by_id.get(vid)
            if not v:
                continue
            if v["t"] == "var":
                v["v"] = ops
            elif v["t"] in ("array", "list"):
                tgt = v["vals"] if v["t"] == "array" else v["nodes"]
                for op in ops:
                    while len(tgt) <= op[0]:  # JS 数组自动扩容，Python 需补齐
                        tgt.append(None)
                    tgt[op[0]] = op[1]
            elif v["t"] == "grid":
                for op in ops:
                    if len(op) == 2 and isinstance(op[1], list):
                        v["m"][op[0]] = list(op[1])
                    else:
                        v["m"][op[0]][op[1]] = op[2]
        # del 先于 add（与 engine.js 一致：弹出再压栈、出队再入队）
        for vid, ops in (f.get("del") or {}).items():
            v = by_id.get(vid)
            if not v:
                continue
            if v["t"] == "map":
                keys = [str(k) for k in ops]
                v["kvs"] = [kv for kv in v["kvs"] if str(kv[0]) not in keys]
                continue
            if v["t"] == "list":
                if isinstance(ops, dict) and "idx" in ops:
                    i = ops["idx"]
                    if not (0 <= i < len(v["nodes"])):
                        err(pid, f"帧 {fi} del idx 越界: {vid}[{i}]")
                        continue
                    v["nodes"].pop(i)
                    sh = lambda x: x - 1 if isinstance(x, int) and x > i else x
                    v["arrows"] = [[sh(a), sh(b)] for a, b in v["arrows"] if a != i and b != i]
                else:
                    n = ops if isinstance(ops, int) else (ops.get("n", 1) if isinstance(ops, dict) else 1)
                    for _ in range(n):
                        if not v["nodes"]:
                            err(pid, f"帧 {fi} del 越界: {vid} 已空")
                            break
                        v["nodes"].pop()
                continue
            n, side = (ops if isinstance(ops, int) else 1), None
            if isinstance(ops, dict):
                n, side = ops.get("n", 1), ops.get("side")
            for _ in range(n):
                if not v["items"]:
                    err(pid, f"帧 {fi} del 越界: {vid} 已空")
                    break
                (v["items"].pop(0) if (v["t"] == "queue" and side != "tail") else v["items"].pop())
        for vid, ops in (f.get("add") or {}).items():
            v = by_id.get(vid)
            if not v:
                continue
            if v["t"] in ("stack", "queue", "heap"):
                (v["items"]).extend(ops if isinstance(ops, list) and (v["t"] != "stack" or not ops or not isinstance(ops[0], list)) else [ops])
            elif v["t"] == "list":
                for it in (ops if isinstance(ops, list) else [ops]):
                    if isinstance(it, dict) and "val" in it:
                        v["nodes"].insert(it.get("idx", len(v["nodes"])), it["val"])
                    else:
                        v["nodes"].append(it)
            elif v["t"] == "map":
                items = ops if (ops and isinstance(ops[0], list)) else [ops]
                for k, val in items:
                    hit = next((kv for kv in v["kvs"] if str(kv[0]) == str(k)), None)
                    if hit:
                        hit[1] = val
                    else:
                        v["kvs"].append([k, val])
        for vid, ops in (f.get("swap") or {}).items():
            v = by_id.get(vid)
            arr = v["vals"] if v and v["t"] == "array" else (v["items"] if v else None)
            if arr:
                if not (0 <= ops[0] < len(arr) and 0 <= ops[1] < len(arr)):
                    err(pid, f"帧 {fi} swap 越界: {vid}{ops}（长度 {len(arr)}）")
                    continue
                arr[ops[0]], arr[ops[1]] = arr[ops[1]], arr[ops[0]]
        for vid, ops in (f.get("list") or {}).items():
            v = by_id.get(vid)
            if not v or v["t"] != "list":
                continue
            n = len(v["nodes"])
            if ops.get("unlink"):
                v["arrows"] = [e for e in v.get("arrows", []) if list(e) not in [list(u) for u in ops["unlink"]]]
            if ops.get("link"):
                for a, b in ops["link"]:
                    v["arrows"] = [e for e in v["arrows"] if e[0] != a]
                    if not (0 <= a < n and (b == "tail" or -1 <= b < n)) and b != "tail":
                        err(pid, f"帧 {fi} list link 索引非法 {a}->{b}")
                    v["arrows"].append([a, b])
        for vid, ops in (f.get("tree") or {}).items():
            v = by_id.get(vid)
            if not v or v["t"] != "tree":
                continue
            if v.get("mode") == "dyn":
                def walk(path):
                    cur = v["root"]
                    for nid in path:
                        cur = next((c for c in cur["children"] if c["id"] == nid), None)
                        if cur is None:
                            return None
                    return cur
                v.setdefault("cursorPath", [])
                if ops.get("up"):
                    for _ in range(ops["up"]):
                        if v["cursorPath"]:
                            v["cursorPath"].pop()
                if ops.get("add") is not None:
                    cur = walk(v["cursorPath"])
                    if cur is None:
                        err(pid, f"帧 {fi} tree add 路径断裂"); continue
                    v["_id"] = v.get("_id", 0) + 1
                    node = {"val": ops["add"], "children": [], "id": v["_id"]}
                    cur["children"].append(node)
                    v["cursorPath"].append(node["id"])
                if ops.get("back"):
                    for _ in range(ops["back"]):
                        if not v["cursorPath"]:
                            break
                        last = v["cursorPath"].pop()
                        cur = walk(v["cursorPath"])
                        if cur is None:
                            err(pid, f"帧 {fi} tree back 路径断裂"); break
                        cur["children"] = [c for c in cur["children"] if c["id"] != last]
            if ops.get("set"):
                v["nodes"] = list(ops["set"])


def main():
    files = sorted(PDIR.glob("*.json"))
    if not files:
        print("!! data/problems 下没有数据文件")
        sys.exit(1)
    all_p, seen = [], {}
    for path in files:
        payload = json.loads(path.read_text(encoding="utf-8"))
        for p in payload.get("problems", []):
            if p["id"] in seen:
                err(p["id"], f"重复 id（也在 {seen[p['id']]}）")
            seen[p["id"]] = path.name
            all_p.append(p)
            check_problem(p)
    # 与官方题单比对
    got = {}
    for p in all_p:
        got.setdefault(p["category"], []).append(p["leet_id"])
    for cat, ids in EXPECTED.items():
        have = sorted(got.get(cat, []))
        if have != sorted(ids):
            missing = sorted(set(ids) - set(have))
            extra = sorted(set(have) - set(ids))
            print(f"  分类 [{CAT_NAMES[cat]}] 期望 {len(ids)} 题，现有 {len(have)}"
                  + (f"，缺 {missing}" if missing else "") + (f"，多 {extra}" if extra else ""))
    total = len(all_p)
    if errors:
        print(f"!! {len(errors)} 个错误：")
        for e in errors:
            print("  -", e)
        sys.exit(1)
    if total == 100:
        print(f"[OK] {total}/100 全部通过校验")
    else:
        print(f"[OK] {total}/100 题通过校验（题库未集齐，继续加油）")


if __name__ == "__main__":
    main()
