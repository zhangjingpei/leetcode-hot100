/* LCAnim - 动画引擎：把 {views, frames} 增量帧流物化为每帧完整快照。
 * 规则：ptr/set/add/del/swap/list/tree/mark 为持久变化；hl 为瞬时焦点；say 必填。
 */
window.LCAnim = (function () {
  function clone(o) { return JSON.parse(JSON.stringify(o)); }

  function normHl(hl) {
    // 统一为 {viewId: [[idx, color|null], ...]}
    if (!hl) return {};
    const out = {};
    for (const [vid, val] of Object.entries(hl)) {
      const arr = Array.isArray(val) ? val : [val];
      out[vid] = arr.map((it) =>
        Array.isArray(it) ? [it[0], it[1] || null] : [it, null]
      );
    }
    return out;
  }

  function applyFrame(state, byId, f) {
    let k, vid, v, ops;
    // 1) 指针移动
    if (f.ptr) for (k in f.ptr) { if (byId[k]) byId[k].i = f.ptr[k]; }
    // 2) 赋值
    if (f.set) for (vid in f.set) {
      v = byId[vid]; ops = f.set[vid]; if (!v) continue;
      if (v.t === "var") { v.v = ops; }
      else if (v.t === "array" || v.t === "list") {
        for (const [i, val] of ops) { if (v.t === "array") v.vals[i] = val; else v.nodes[i] = val; }
      }       else if (v.t === "grid") {
        for (const op of ops) {
          if (op.length === 2 && Array.isArray(op[1])) v.m[op[0]] = op[1].slice(); // 整行替换
          else v.m[op[0]][op[1]] = op[2];
        }
      }
    }
    // 3) 删除（队列默认出队头、栈默认弹栈顶；del 可传 {n, side:"head"|"tail"}；list 另支持 {idx} 按索引删并平移箭头；map 按键删）
    if (f.del) for (vid in f.del) {
      v = byId[vid]; ops = f.del[vid]; if (!v) continue;
      if (v.t === "map") { const keys = ops.map(String); v.kvs = v.kvs.filter((kv) => !keys.includes(String(kv[0]))); }
      else if (v.t === "list") {
        if (ops && typeof ops === "object" && ops.idx !== undefined) {
          const i = ops.idx;
          if (i >= 0 && i < v.nodes.length) {
            v.nodes.splice(i, 1);
            const sh = (x) => (typeof x === "number" ? (x > i ? x - 1 : x) : x);
            v.arrows = (v.arrows || []).filter((e) => e[0] !== i && e[1] !== i).map((e) => [sh(e[0]), sh(e[1])]);
          }
        } else {
          let n = ops;
          if (ops && typeof ops === "object") n = ops.n;
          for (let x = 0; x < n; x++) if (v.nodes.length) v.nodes.pop();
        }
      }
      else {
        let n = ops, side = null;
        if (ops && typeof ops === "object") { n = ops.n; side = ops.side; }
        for (let x = 0; x < n; x++) {
          if (v.items.length) {
            if (v.t === "queue" && side !== "tail") v.items.shift();
            else v.items.pop();
          }
        }
      }
    }
    // 4) 追加（入栈/入队/加节点/加KV，支持单值或数组）
    if (f.add) for (vid in f.add) {
      v = byId[vid]; ops = f.add[vid]; if (!v) continue;
      const items = Array.isArray(ops) && (v.t !== "map" || Array.isArray(ops[0])) ? ops : [ops];
      if (v.t === "stack" || v.t === "queue" || v.t === "heap") v.items.push(...items);
      else if (v.t === "list") {
        for (const it of items) {
          if (it && typeof it === "object" && it.val !== undefined) {
            v.nodes.splice(it.idx === undefined ? v.nodes.length : it.idx, 0, it.val); // {val, idx} 按位插入
          } else v.nodes.push(it);
        }
      }
      else if (v.t === "map") {
        for (const [key, val] of items) {
          const hit = v.kvs.find((kv) => String(kv[0]) === String(key));
          if (hit) hit[1] = val; else v.kvs.push([key, val]);
        }
      }
    }
    // 5) 交换
    if (f.swap) for (vid in f.swap) {
      v = byId[vid]; if (!v) continue;
      const [i, j] = f.swap[vid]; const arr = v.vals || v.items;
      if (arr) { const t = arr[i]; arr[i] = arr[j]; arr[j] = t; }
    }
    // 6) 链表箭头重连：{listId: {link:[[a,b]], unlink:[[a,b]]}}
    if (f.list) for (vid in f.list) {
      v = byId[vid]; if (!v || v.t !== "list") continue;
      const op = f.list[vid];
      if (op.unlink) v.arrows = (v.arrows || []).filter((e) => !op.unlink.some((u) => u[0] === e[0] && u[1] === e[1]));
      if (op.link) for (const [a, b] of op.link) {
        v.arrows = (v.arrows || []).filter((e) => e[0] !== a); // 每节点唯一出边
        v.arrows.push([a, b]);
      }
    }
    // 7) 回溯树生长/回退：{treeId: {add:"v", back:n, edge:[[id,color]]}}（cursorPath 方案避免循环引用）
    if (f.tree) for (vid in f.tree) {
      v = byId[vid]; if (!v || v.t !== "tree") continue;
      const op = f.tree[vid];
      if (op.set) v.nodes = op.set.slice();
      if (v.mode === "dyn") {
        const walk = () => { let cur = v.root; for (const id of v.cursorPath) cur = cur.children.find((c) => c.id === id); return cur; };
        if (op.up) for (let x = 0; x < op.up && v.cursorPath.length; x++) v.cursorPath.pop(); // 仅上移不删节点
        if (op.add !== undefined) {
          const node = { val: op.add, children: [], id: ++v._id };
          walk().children.push(node);
          v.cursorPath.push(node.id);
        }
        if (op.back) for (let x = 0; x < op.back && v.cursorPath.length; x++) {
          const lastId = v.cursorPath.pop();
          const cur = walk();
          cur.children = cur.children.filter((c) => c.id !== lastId);
        }
      }
      if (op.edge) { v.edgeColor = v.edgeColor || {}; for (const [ci, col] of op.edge) v.edgeColor[ci] = col; }
    }
    // 8) 持久角标：{viewId: {pos: text|null}}
    if (f.mark) for (vid in f.mark) {
      v = byId[vid]; if (!v) continue;
      v.marks = v.marks || {};
      for (const pos in f.mark[vid]) {
        const txt = f.mark[vid][pos];
        if (txt === null) delete v.marks[pos]; else v.marks[pos] = txt;
      }
    }
  }

  function materialize(anim) {
    const state = clone(anim.views || []);
    const byId = {};
    // 归一化：补全缺省容器字段，避免后续操作访问 undefined
    for (const vw of state) {
      if (vw.t === "map" && !vw.kvs) vw.kvs = [];
      if ((vw.t === "stack" || vw.t === "queue" || vw.t === "heap") && !vw.items) vw.items = [];
      if (vw.t === "array" && !vw.vals) vw.vals = [];
      if (vw.t === "list" && !vw.nodes) { vw.nodes = []; vw.arrows = []; }
      if (vw.t === "tree" && vw.mode === "dyn") { vw.cursorPath = []; vw._id = 0; }
      byId[vw.id] = vw;
    }
    const snaps = [];
    for (const f of anim.frames || []) {
      applyFrame(state, byId, f);
      snaps.push({ views: clone(state), hl: normHl(f.hl), say: f.say || "" });
    }
    if (!snaps.length) snaps.push({ views: clone(state), hl: {}, say: "（无动画数据）" });
    return snaps;
  }

  return { materialize };
})();
