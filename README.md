# LeetCode Hot 100 · 图解刷题教程

一个**零依赖、零构建**的本地刷题教程网站：LeetCode Hot 100 全部 100 题，按官方 17 个专题分类，
每题包含题意、示例、思路、复杂度、Python 题解（语法高亮），以及一段**可逐步播放的 2D 算法动画讲解**。

## 快速开始

```bash
cd leetcode-hot100
pip install fastapi uvicorn
python3 run.py          # 默认 http://localhost:8000
```

打开浏览器访问 `http://localhost:8000` 即可。所有数据启动时载入内存，无数据库。

## 功能

- **列表页**：17 个专题分组浏览、难度筛选、关键词搜索、完成度标记（localStorage）
- **详情页**：题目描述 / 示例 / 约束、思路要点、复杂度、Python 题解（自研轻量语法高亮）
- **2D 动画播放器**：
  - 播放 / 暂停 / 单步 / 跳转进度条 / 变速
  - 视图类型：数组、指针、栈、队列、堆（树形）、哈希表、链表、二叉树、网格、图、变量
  - 每帧一条解说，支持「跳步」式讲解（一帧可承载一次转移或多格填表）

## 目录结构

```
leetcode-hot100/
├── run.py                  # 启动入口
├── app/
│   ├── main.py             # FastAPI 应用与静态资源挂载
│   ├── api.py              # /api 路由（薄层）
│   └── services.py         # 数据聚合服务（启动时全量加载进内存）
├── data/
│   ├── catalog.json        # 静态目录快照（tools/gen_catalog.py 生成）
│   └── problems/           # 17 个分类文件，共 100 题
│       ├── 01-hash.json
│       ├── ...
│       └── 17-techniques.json
├── static/
│   ├── css/                # base / list / detail / player 样式
│   ├── js/
│   │   ├── common.js / list.js / detail.js / highlight.js
│   │   └── player/         # engine.js（帧物化）+ layout.js + render.js + player.js
│   ├── index.html          # 列表页
│   └── problem.html        # 详情页（JS 渲染骨架）
├── tools/
│   ├── validate_data.py    # 数据强校验：结构 + 引用 + replay 重放
│   └── gen_catalog.py      # 重建 catalog.json
└── tests/                  # pytest：数据完整性 + API 集成
```

## 动画数据格式（声明式）

动画不是视频，而是**声明式帧数据**：`views` 声明初始结构，`frames` 增量描述每一步，
引擎 `engine.js` 把增量物化为每一帧的完整快照，因此支持拖动进度条跳到任意一步。

```jsonc
{
  "views":  [{"t": "array", "id": "a", "vals": [2, 7, 11], "label": "nums"},
             {"t": "ptr", "id": "l", "on": "a", "i": 0, "name": "左"}],
  "frames": [
    {"say": "题意……"},
    {"say": "左指针右移", "ptr": {"l": 1}, "hl": {"a": [[1, "#2ea44f"]]}},
    {"say": "交换首尾", "swap": {"a": [0, 2]}}
  ]
}
```

帧操作语义（与校验器 replay 严格一致）：

| 操作   | 语义                                                        |
| ------ | ----------------------------------------------------------- |
| `set`  | var 直接赋值；array/list 按下标替换（可扩容）；grid 两种形式：`[行, [整行]]` 或 `[行, 列, 值]`；map 为 no-op（改用 add） |
| `add`  | stack/queue/heap 尾部入；map 为 upsert（`[k, v]` 对）         |
| `del`  | 先于同帧 `add` 执行（弹出再压栈、出队再入队）                 |
| `swap` | 下标交换；stack/queue/heap 基于 items 运行时判定越界           |
| `ptr`  | 指针移动（`{"指针id": 下标}`）                                |
| `hl`   | 高亮：array 下标对列表、grid `"r,c"` 键、graph 节点 id 列表    |

## 工具

```bash
python3 tools/validate_data.py   # 全量校验：字段、引用、越界、replay 重放（改数据后必跑）
python3 tools/gen_catalog.py     # 重建 data/catalog.json
python3 -m pytest tests/ -q      # 数据完整性 + API 集成测试
```

## 数据规模

- 100 题 / 17 专题（哈希、双指针、滑动窗口、子串、普通数组、矩阵、链表、二叉树、图论、回溯、
  二分查找、栈、堆、贪心、动态规划、多维动态规划、技巧）
- 每题动画 ≥ 6 帧，全部通过 replay 重放校验与浏览器实测
