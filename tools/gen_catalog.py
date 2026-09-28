#!/usr/bin/env python3
"""从 data/problems/*.json 汇总生成 data/catalog.json（静态索引，便于离线部署/校验）。
后端 services.py 是动态聚合的，此文件仅作为静态产物与一致性快照。
用法：python3 tools/gen_catalog.py
"""
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / "app"))
import services  # noqa: E402


def main():
    cat = services.catalog()
    out = ROOT / "data" / "catalog.json"
    out.write_text(json.dumps(cat, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"catalog.json 已生成：{cat['total']} 题 / {len(cat['categories'])} 分类")


if __name__ == "__main__":
    main()
