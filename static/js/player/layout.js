/* LCLayout - 11 种 view 的纯函数布局：state + hl → SVG 图元数组。
 * shape 统一结构 {key, tag, x, y, ...attrs}，由 LCRender 映射为 SVG。
 */
window.LCLayout = (function () {
  const W = 960;
  const HL = "#f59e0b";           // 默认高亮色（琥珀）
  const C = {
    cellFill: "#eef2f7", cellStroke: "#c9d3e0", ink: "#1f2430", muted: "#6b7280",
    ptr: "#e5484d", edge: "#9aa7b8", good: "#2ea44f", card: "#ffffff",
  };

  const esc = (s) => String(s);

  function hlMapOf(hl, vid) {
    const m = new Map();
    const arr = hl && hl[vid];
    if (arr) for (const [pos, col] of arr) m.set(String(pos), col);
    return m;
  }
  const hlCol = (m, pos) => m.has(String(pos)) ? (m.get(String(pos)) || HL) : null;

  function txt(key, x, y, t, o = {}) {
    return { key, tag: "text", x, y, t: esc(t), fs: o.fs || 14, fill: o.fill || C.ink, fw: o.fw || 500, anchor: o.anchor || "middle", italic: o.italic || false };
  }
  function rect(key, x, y, w, h, o = {}) {
    return { key, tag: "rect", x, y, w, h, rx: o.rx === undefined ? 6 : o.rx, fill: o.fill || C.cellFill, stroke: o.stroke || C.cellStroke, sw: o.sw === undefined ? 1.4 : o.sw, dash: o.dash };
  }
  function circ(key, x, y, r, o = {}) {
    return { key, tag: "circle", x, y, r, fill: o.fill || C.card, stroke: o.stroke || "#94a3b8", sw: o.sw === undefined ? 1.6 : o.sw };
  }
  function line(key, x, y, dx, dy, o = {}) {
    return { key, tag: "line", x, y, dx, dy, stroke: o.stroke || C.edge, sw: o.sw || 2 };
  }
  function tri(key, x, y, dx, dy, o = {}) { // 箭头三角：从 (x,y) 指向 (x+dx,y+dy) 方向的尖端
    const ang = Math.atan2(dy, dx), L = 9;
    const b1x = -L * Math.cos(ang - 0.42), b1y = -L * Math.sin(ang - 0.42);
    const b2x = -L * Math.cos(ang + 0.42), b2y = -L * Math.sin(ang + 0.42);
    return { key, tag: "path", x, y, d: `M0,0 L${b1x.toFixed(1)},${b1y.toFixed(1)} L${b2x.toFixed(1)},${b2y.toFixed(1)} Z`, fill: o.fill || C.edge };
  }
  function arrow(key, x, y, dx, dy, o = {}) { // 线 + 尖端三角
    return [line(key + ":l", x, y, dx, dy, o), tri(key + ":t", x + dx, y + dy, dx, dy, o)];
  }
  const strW = (s) => String(s).length * 8.4 + 10;

  /* ---------- 各类型布局 ---------- */

  function layArray(v, y, hlm) {
    const vals = v.vals || [], n = vals.length;
    const cw = n > 16 ? 38 : n > 11 ? 44 : 52, ch = 40;
    const x0 = (W - n * cw) / 2, shapes = [];
    if (v.label) shapes.push(txt(v.id + ":lb", x0 - 14, y + ch / 2 + 5, v.label, { anchor: "end", fill: C.muted, fs: 13 }));
    for (let i = 0; i < n; i++) {
      const x = x0 + i * cw;
      const col = hlCol(hlm, i);
      const fill = col || (v.cmap && v.cmap[String(vals[i])]) || (v.cmap ? "#f3f4f6" : C.cellFill);
      shapes.push(rect(`${v.id}:c${i}`, x, y, cw - 5, ch, { fill, stroke: col || C.cellStroke, sw: col ? 2.4 : 1.4 }));
      let shown = vals[i];
      if (v.fmt === "bits" && typeof shown === "number") shown = shown.toString(2);
      shapes.push(txt(`${v.id}:v${i}`, x + (cw - 5) / 2, y + ch / 2 + 5, shown, { fs: shown !== null && String(shown).length > 3 ? 12 : 14, fw: 600 }));
      shapes.push(txt(`${v.id}:i${i}`, x + (cw - 5) / 2, y + ch + 15, i, { fs: 11, fill: C.muted }));
      if (v.marks && v.marks[i] !== undefined)
        shapes.push(txt(`${v.id}:mk${i}`, x + (cw - 5) / 2, y - 6, v.marks[i], { fs: 11, fill: "#e5484d", fw: 600 }));
    }
    return { shapes, h: ch + 28, region: { x0, cw, n, topY: y, botY: y + ch, xOf: (i) => x0 + (Array.isArray(i) ? i[0] : i) * cw + (cw - 5) / 2 } };
  }

  function layPtr(p, region) {
    const shapes = [];
    const px = p.i === -1 || p.i === "tail" ? region.x0 - 24 : region.xOf(p.i);
    const up = (p.dy === undefined ? -1 : p.dy) === -1;
    const col = p.color || C.ptr;
    if (up) {
      shapes.push({ key: `${p.id}:p`, tag: "path", x: px, y: region.topY - 15, d: "M0,12 L-7,0 L7,0 Z", fill: col });
      shapes.push(txt(`${p.id}:n`, px, region.topY - 22, p.name, { fs: 12.5, fw: 700, fill: col }));
    } else {
      shapes.push({ key: `${p.id}:p`, tag: "path", x: px, y: region.botY + 15, d: "M0,-12 L-7,0 L7,0 Z", fill: col });
      shapes.push(txt(`${p.id}:n`, px, region.botY + 27, p.name, { fs: 12.5, fw: 700, fill: col }));
    }
    return shapes;
  }

  function layVar(v, y, hlm) {
    const label = v.label || v.id, val = v.fmt === "bin" && typeof v.v === "number" ? "0b" + v.v.toString(2) : v.v;
    const w = Math.min(430, Math.max(96, strW(label) + strW(val) + 40)), h = 42;
    const x0 = (W - w) / 2, shapes = [];
    shapes.push(rect(`${v.id}:box`, x0, y, w, h, { rx: 21, fill: "#fff7ed", stroke: hlCol(hlm, "v") || "#fdba74", sw: hlCol(hlm, "v") ? 2.4 : 1.4 }));
    shapes.push(txt(`${v.id}:l`, x0 + 18, y + h / 2 + 5, label, { anchor: "start", fill: C.muted, fs: 13 }));
    shapes.push(txt(`${v.id}:v`, x0 + w - 18, y + h / 2 + 5, val, { anchor: "end", fw: 700, fs: 15 }));
    return { shapes, h: h + 6, region: { x0, topY: y, botY: y + h } };
  }

  function layMap(v, y, hlm) {
    const shapes = [], kvs = v.kvs || [];
    const items = kvs.map(([k, val], i) => ({ i, k, val, kw: Math.max(30, strW(k)), vw: Math.max(34, strW(val)) }));
    // 贪心分行（每行最宽 820）
    const rows = [[]]; let rowW = 0;
    for (const it of items) {
      const w = it.kw + it.vw + 10;
      if (rowW + w > 820 && rows[rows.length - 1].length) { rows.push([]); rowW = 0; }
      rows[rows.length - 1].push(it); rowW += w;
    }
    rows.forEach((row, ri) => {
      const rw = row.reduce((s, it) => s + it.kw + it.vw + 10, -10);
      let x = Math.max(46, (W - rw) / 2);
      if (ri === 0 && v.label) shapes.push(txt(`${v.id}:lb`, x - 12, y + ri * 46 + 24, v.label, { anchor: "end", fill: C.muted, fs: 12.5 }));
      for (const it of row) {
        const yy = y + ri * 46, col = hlCol(hlm, it.i);
        shapes.push(rect(`${v.id}:k${it.i}`, x, yy, it.kw, 38, { rx: 6, fill: col || "#e0e7ff", stroke: col || "#c7d2fe", sw: col ? 2.2 : 1.3 }));
        shapes.push(txt(`${v.id}:kt${it.i}`, x + it.kw / 2, yy + 24, it.k, { fw: 600, fs: 13 }));
        shapes.push(rect(`${v.id}:vv${it.i}`, x + it.kw, yy, it.vw, 38, { rx: 6, fill: "#fff", stroke: "#c7d2fe", sw: 1.3 }));
        shapes.push(txt(`${v.id}:vt${it.i}`, x + it.kw + it.vw / 2, yy + 24, it.val, { fs: 13 }));
        x += it.kw + it.vw + 10;
      }
    });
    if (!kvs.length) shapes.push(txt(`${v.id}:e`, W / 2, y + 24, "(空)", { fill: "#b0b7c3", fs: 13 }));
    return { shapes, h: rows.length * 46 + 6, region: { x0: 46, topY: y, botY: y + rows.length * 46 } };
  }

  function layStack(v, y, hlm) {
    const shapes = [], items = v.items || [];
    const iw = 120, ih = 32, x0 = W / 2 - 40;
    if (v.label) shapes.push(txt(`${v.id}:lb`, x0 - 16, y + 20, v.label, { anchor: "end", fill: C.muted, fs: 13 }));
    for (let i = 0; i < items.length; i++) {
      const yy = y + (items.length - 1 - i) * 38 + 8;
      const col = hlCol(hlm, i);
      shapes.push(rect(`${v.id}:s${i}`, x0, yy, iw, ih, { rx: 6, fill: col || C.cellFill, stroke: col || C.cellStroke, sw: col ? 2.4 : 1.4 }));
      shapes.push(txt(`${v.id}:sv${i}`, x0 + iw / 2, yy + ih / 2 + 5, items[i], { fw: 600 }));
    }
    if (items.length) shapes.push(txt(`${v.id}:top`, x0 + iw + 12, y + 8 + ih / 2 + 5, "◀ 栈顶", { anchor: "start", fill: C.muted, fs: 12 }));
    else shapes.push(txt(`${v.id}:e`, x0 + iw / 2, y + 24, "(空)", { fill: "#b0b7c3", fs: 13 }));
    return { shapes, h: Math.max(items.length, 1) * 38 + 14, region: { x0, topY: y, botY: y + Math.max(items.length, 1) * 38 } };
  }

  function layQueue(v, y, hlm) {
    const shapes = [], items = v.items || [];
    const iw = 56, ih = 36, gap = 8, n = items.length;
    const x0 = (W - n * (iw + gap)) / 2 + 20;
    if (v.label) shapes.push(txt(`${v.id}:lb`, x0 - 28, y + ih / 2 + 5, v.label, { anchor: "end", fill: C.muted, fs: 13 }));
    for (let i = 0; i < n; i++) {
      const x = x0 + i * (iw + gap), col = hlCol(hlm, i);
      shapes.push(rect(`${v.id}:q${i}`, x, y, iw, ih, { rx: 6, fill: col || C.cellFill, stroke: col || C.cellStroke, sw: col ? 2.4 : 1.4 }));
      shapes.push(txt(`${v.id}:qv${i}`, x + iw / 2, y + ih / 2 + 5, items[i], { fw: 600 }));
    }
    shapes.push(txt(`${v.id}:hd`, x0 - 26, y + ih / 2 + 5, "队头 ▶", { anchor: "end", fill: C.muted, fs: 12 }));
    if (!n) shapes.push(txt(`${v.id}:e`, x0, y + ih / 2 + 5, "(空)", { fill: "#b0b7c3", fs: 13 }));
    return { shapes, h: ih + 8, region: { x0, topY: y, botY: y + ih } };
  }

  function layList(v, y, hlm) {
    const shapes = [], nodes = v.nodes || [], n = nodes.length;
    const nw = 58, nh = 38, gap = n > 9 ? 70 : 86;
    const total = n * nw + (n - 1) * (gap - nw) + 34;
    const x0 = Math.max(30, (W - total) / 2);
    const yc = y, xm = (i) => x0 + i * gap;
    if (v.label) shapes.push(txt(`${v.id}:lb`, x0 - 14, yc + nh / 2 + 5, v.label, { anchor: "end", fill: C.muted, fs: 13 }));
    const arrows = v.arrows || Array.from({ length: Math.max(n - 1, 0) }, (_, i) => [i, i + 1]).concat(n ? [[n - 1, "tail"]] : []);
    for (let i = 0; i < n; i++) {
      const col = hlCol(hlm, i);
      shapes.push(rect(`${v.id}:n${i}`, xm(i), yc, nw, nh, { rx: 8, fill: col || C.cellFill, stroke: col || C.cellStroke, sw: col ? 2.6 : 1.4 }));
      shapes.push(txt(`${v.id}:nv${i}`, xm(i) + nw / 2, yc + nh / 2 + 5, nodes[i], { fw: 600 }));
      if (v.marks && v.marks[i] !== undefined)
        shapes.push(txt(`${v.id}:mk${i}`, xm(i) + nw / 2, yc - 6, v.marks[i], { fs: 11, fill: "#e5484d", fw: 600 }));
    }
    for (let e = 0; e < arrows.length; e++) {
      const [a, b] = arrows[e];
      const ax = xm(a) + nw, ay = yc + nh / 2;
      const bx = b === "tail" || b >= n ? xm(n - 1) + nw + 26 : xm(b);
      shapes.push(...arrow(`${v.id}:a${e}`, ax, ay, bx - ax, 0, { stroke: "#8b98a9", sw: 2 }));
    }
    shapes.push(txt(`${v.id}:tail`, xm(Math.max(n - 1, 0)) + nw + 36, yc + nh / 2 + 6, "∅", { fs: 16, fill: C.muted }));
    return { shapes, h: nh + 22, region: { x0, cw: gap, n, topY: yc, botY: yc + nh, xOf: (i) => i === -1 ? x0 - 24 : i === "tail" ? xm(n - 1) + nw + 36 : xm(i) + nw / 2 } };
  }

  function layTreeStatic(v, y, hlm) {
    const arr = v.nodes || [], shapes = [];
    const nodes = []; // {idx,val,depth,lseq,children:[idx]}
    const posOf = {};
    // 层序 → 树
    let qi = [];
    if (arr.length && arr[0] !== null) { nodes.push({ idx: 0, val: arr[0], depth: 0, children: [] }); qi.push(0); }
    let ni = 1;
    while (qi.length) {
      const cur = nodes[qi.shift()];
      for (let k = 0; k < 2 && ni < arr.length; k++) {
        if (arr[ni] !== null) {
          const nd = { idx: ni, val: arr[ni], depth: cur.depth + 1, children: [] };
          nodes.push(nd); qi.push(nodes.length - 1);
          cur.children.push(nodes.length - 1);
        }
        ni++;
      }
    }
    // 中序序号 → x
    let seq = 0;
    (function ino(i) { if (i === undefined) return; const nd = nodes[i]; if (!nd) return; ino(nd.children[0]); nd.lseq = seq++; ino(nd.children[1]); })(0);
    const cnt = Math.max(nodes.filter((nd) => nd.lseq !== undefined).length, 1);
    const xg = Math.min(64, (W - 100) / cnt), yg = 62;
    const xc = (nd) => W / 2 + (nd.lseq - (cnt - 1) / 2) * xg;
    const yc2 = (nd) => y + 26 + nd.depth * yg;
    for (const nd of nodes) {
      if (nd.lseq === undefined) continue;
      for (const ci of nd.children) {
        const ch = nodes[ci]; if (ch.lseq === undefined) continue;
        const ecol = v.edgeColor && v.edgeColor[ch.idx];
        shapes.push(line(`${v.id}:e${ci}`, xc(nd), yc2(nd) + 15, xc(ch) - xc(nd), yc2(ch) - yc2(nd) - 15, { stroke: ecol || "#a8b3c2", sw: ecol ? 2.6 : 1.8 }));
      }
    }
    let maxD = 0;
    for (const nd of nodes) {
      if (nd.lseq === undefined) continue;
      maxD = Math.max(maxD, nd.depth);
      const col = hlCol(hlm, nd.idx);
      shapes.push(circ(`${v.id}:n${nd.idx}`, xc(nd), yc2(nd), 17, { fill: col || "#fff", stroke: col || "#8b98a9", sw: col ? 2.8 : 1.7 }));
      shapes.push(txt(`${v.id}:nv${nd.idx}`, xc(nd), yc2(nd) + 5, nd.val, { fs: String(nd.val).length > 2 ? 11.5 : 13, fw: 600 }));
      if (v.marks && v.marks[nd.idx] !== undefined)
        shapes.push(txt(`${v.id}:mk${nd.idx}`, xc(nd), yc2(nd) - 24, v.marks[nd.idx], { fs: 11, fill: "#e5484d", fw: 600 }));
    }
    return { shapes, h: (maxD + 1) * yg + 30, region: { x0: 0, topY: y, botY: y + (maxD + 1) * yg, xOf: (i) => xc(nodes[i]) } };
  }

  function layTreeDyn(v, y, hlm) {
    const shapes = [];
    const LEAF = 46, YG = 56;
    let leafSeq = 0, maxD = 0;
    // 递归分配 x：叶子按序占槽，父取子均值
    (function place(nd, depth) {
      nd._depth = depth; maxD = Math.max(maxD, depth);
      if (!nd.children.length) { nd._x = W / 2 + (leafSeq++ - 0) * LEAF; return; }
      nd.children.forEach((c) => place(c, depth + 1));
      nd._x = nd.children.reduce((s, c) => s + c._x, 0) / nd.children.length;
    })(v.root, 0);
    // 水平居中
    let lo = Infinity, hi = -Infinity;
    (function rng(nd) { lo = Math.min(lo, nd._x); hi = Math.max(hi, nd._x); nd.children.forEach(rng); })(v.root);
    const shift = W / 2 - (lo + hi) / 2;
    const yc2 = (nd) => y + 24 + nd._depth * YG;
    const cursorId = (v.cursorPath && v.cursorPath.length) ? v.cursorPath[v.cursorPath.length - 1] : null;
    (function draw(nd) {
      const x = nd._x + shift, yy = yc2(nd);
      for (const c of nd.children) {
        const ecol = v.edgeColor && v.edgeColor[c.id];
        shapes.push(line(`${v.id}:e${c.id}`, x, yy + 14, (c._x + shift) - x, yc2(c) - yy - 14, { stroke: ecol || "#a8b3c2", sw: ecol ? 2.6 : 1.8 }));
      }
      const col = hlCol(hlm, nd.id);
      const isCur = nd.id === cursorId;
      shapes.push(circ(`${v.id}:n${nd.id}`, x, yy, 15.5, { fill: col || "#fff", stroke: isCur ? "#f59e0b" : col || "#8b98a9", sw: isCur ? 3 : col ? 2.8 : 1.6 }));
      shapes.push(txt(`${v.id}:nv${nd.id}`, x, yy + 4.5, nd.val, { fs: String(nd.val).length > 2 ? 10.5 : 12.5, fw: 600 }));
      nd.children.forEach(draw);
    })(v.root);
    return { shapes, h: (maxD + 1) * YG + 26, region: { x0: 0, topY: y, botY: y + (maxD + 1) * YG } };
  }

  function layGrid(v, y, hlm) {
    const shapes = [], m = v.m || [], rows = m.length, cols = rows ? m[0].length : 0;
    const hasC = v.colHead && v.colHead.length, hasR = v.rowHead && v.rowHead.length;
    let cell = v.cell || 40;
    cell = Math.min(cell, (W - 120) / Math.max(cols + (hasR ? 1 : 0), 1));
    cell = Math.min(cell, 46);
    const gy = y + (hasC ? 24 : 0), gx = (W - (cols + (hasR ? 1 : 0)) * cell) / 2 + (hasR ? 0 : 0);
    if (v.label) shapes.push(txt(`${v.id}:lb`, gx - 12, y + 14, v.label, { anchor: "end", fill: C.muted, fs: 12.5 }));
    if (hasC) for (let c = 0; c < v.colHead.length; c++)
      shapes.push(txt(`${v.id}:ch${c}`, gx + (hasR ? 1 : 0) * cell + c * cell + cell / 2, y + 16, v.colHead[c], { fs: 13, fw: 600, fill: "#475569" }));
    for (let r = 0; r < rows; r++) {
      if (hasR) shapes.push(txt(`${v.id}:rh${r}`, gx + cell / 2, gy + r * cell + cell / 2 + 5, v.rowHead[r], { fs: 13, fw: 600, fill: "#475569" }));
      for (let c = 0; c < cols; c++) {
        const x = gx + (hasR ? 1 : 0) * cell + c * cell, yy = gy + r * cell;
        const key = `${r},${c}`;
        const col = hlCol(hlm, key) || hlCol(hlm, `${r}:${c}`);
        const fill = col || (v.cmap && v.cmap[String(m[r][c])]) || "#fbfcfe";
        shapes.push(rect(`${v.id}:g${r}_${c}`, x + 1, yy + 1, cell - 2, cell - 2, { rx: 3, fill, stroke: col ? col : "#d6dde6", sw: col ? 2.2 : 1 }));
        const val = m[r][c];
        if (val !== null && val !== "")
          shapes.push(txt(`${v.id}:gt${r}_${c}`, x + 1 + (cell - 2) / 2, yy + 1 + cell / 2 + 5, val, { fs: val !== null && String(val).length > 2 ? 11 : 13, fw: 600 }));
        if (v.marks && v.marks[key] !== undefined)
          shapes.push(txt(`${v.id}:mk${r}_${c}`, x + 1 + 6, yy + 1 + 10, v.marks[key], { fs: 9.5, fill: "#e5484d", fw: 700, anchor: "start" }));
      }
    }
    return {
      shapes, h: rows * cell + (hasC ? 24 : 0) + 10,
      region: { x0: gx, cw: cell, topY: gy, botY: gy + rows * cell, xOf: (i) => Array.isArray(i) ? gx + (hasR ? 1 : 0) * cell + i[1] * cell + cell / 2 : gx },
    };
  }

  function layHeap(v, y, hlm) {
    const shapes = [], items = v.items || [], n = items.length;
    let maxD = 0;
    const pos = [];
    for (let i = 0; i < n; i++) {
      const d = Math.floor(Math.log2(i + 1)), j = i - (Math.pow(2, d) - 1), cnt = Math.pow(2, d);
      maxD = Math.max(maxD, d);
      const lw = Math.min(80, (W - 100) / cnt);
      pos[i] = { x: W / 2 + (j + 0.5 - cnt / 2) * lw, y: y + 26 + d * 58, d };
    }
    for (let i = 1; i < n; i++) {
      const p = pos[(i - 1) >> 1], q = pos[i];
      shapes.push(line(`${v.id}:e${i}`, p.x, p.y + 15, q.x - p.x, q.y - p.y - 15, { stroke: "#a8b3c2", sw: 1.8 }));
    }
    for (let i = 0; i < n; i++) {
      const col = hlCol(hlm, i);
      shapes.push(circ(`${v.id}:n${i}`, pos[i].x, pos[i].y, 17, { fill: col || "#fff", stroke: col || "#8b98a9", sw: col ? 2.8 : 1.7 }));
      shapes.push(txt(`${v.id}:nv${i}`, pos[i].x, pos[i].y + 5, items[i], { fs: 13, fw: 600 }));
      shapes.push(txt(`${v.id}:ni${i}`, pos[i].x + 22, pos[i].y + 14, i, { fs: 9.5, fill: C.muted }));
    }
    return { shapes, h: (maxD + 1) * 58 + 34, region: { x0: 0, topY: y, botY: y + (maxD + 1) * 58 } };
  }

  function layGraph(v, y, hlm) {
    const shapes = [], nodes = v.nodes || [], edges = v.edges || [];
    const n = nodes.length, h = Math.max(170, Math.min(300, n * 40));
    const cx = W / 2, cy = y + h / 2, R = Math.min(185, h / 2 - 34);
    const pos = nodes.map((nd, i) => {
      const ang = -Math.PI / 2 + (2 * Math.PI * i) / n;
      return { x: cx + R * Math.cos(ang), y: cy + R * Math.sin(ang) };
    });
    for (let e = 0; e < edges.length; e++) {
      const [a, b, col] = edges[e];
      const p = pos[a], q = pos[b];
      const ang = Math.atan2(q.y - p.y, q.x - p.x);
      const sx = p.x + 23 * Math.cos(ang), sy = p.y + 23 * Math.sin(ang);
      const ex = q.x - 26 * Math.cos(ang), ey = q.y - 26 * Math.sin(ang);
      const ecol = col || hlCol(hlm, `e${e}`) || "#9aa7b8";
      shapes.push(...arrow(`${v.id}:ed${e}`, sx, sy, ex - sx, ey - sy, { stroke: ecol, sw: 2, fill: ecol }));
    }
    for (let i = 0; i < n; i++) {
      const col = hlCol(hlm, i);
      shapes.push(circ(`${v.id}:n${i}`, pos[i].x, pos[i].y, 21, { fill: col || "#fff", stroke: col || "#64748b", sw: col ? 2.8 : 1.8 }));
      shapes.push(txt(`${v.id}:nv${i}`, pos[i].x, pos[i].y + 4.5, nodes[i].label !== undefined ? nodes[i].label : nodes[i], { fs: 12, fw: 600 }));
    }
    return { shapes, h: h + 10, region: { x0: cx - R, topY: y, botY: y + h } };
  }

  const LAYOUTS = {
    array: layArray, var: layVar, map: layMap, stack: layStack, queue: layQueue,
    list: layList, grid: layGrid, heap: layHeap, graph: layGraph,
  };

  function layoutAll(views, hl) {
    const shapes = [];
    const regions = {};
    const ptrs = [];
    let y = 8;
    for (const v of views || []) {
      if (v.t === "ptr") { ptrs.push(v); continue; }
      let r;
      if (v.t === "tree") r = v.mode === "dyn" ? layTreeDyn(v, y, hlMapOf(hl, v.id)) : layTreeStatic(v, y, hlMapOf(hl, v.id));
      else r = (LAYOUTS[v.t] || layVar)(v, y, hlMapOf(hl, v.id));
      shapes.push(...r.shapes);
      regions[v.id] = r.region;
      y += r.h + 14;
    }
    for (const p of ptrs) {
      const rg = regions[p.on];
      if (rg) shapes.push(...layPtr(p, rg));
    }
    return { shapes, height: y + 4 };
  }

  return { layoutAll, W, HL };
})();
