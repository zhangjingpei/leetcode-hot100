/* 详情页：题意 / 思路 / 复杂度 / Python 题解 / 2D 动画播放器 */
(function () {
  const slug = location.pathname.split("/").pop();

  // 轻量 Markdown：先转义，再渲染 `code` 与 **加粗**
  const fmt = (s) => LC.esc(s)
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(/\*\*([^*]+)\*\*/g, "<b>$1</b>");

  async function init() {
    const p = await LC.jget(`/api/problems/${slug}`);
    const cat = await LC.jget("/api/catalog");
    const catName = (cat.categories.find((c) => c.id === p.category) || {}).name || p.category;
    document.title = `${p.num}. ${p.title_cn} · LeetCode Hot 100`;

    renderHead(p, catName);
    renderStatement(p.statement);
    renderSolution(p.solution);
    renderAnim(p.anim);
    renderPager(cat, p);
    bindDoneToggle(p.id);
    window.scrollTo(0, 0);
  }

  function renderHead(p, catName) {
    document.getElementById("detail").insertAdjacentHTML("beforebegin", "");
    const done = LC.isDone(p.id);
    document.querySelector(".topbar-inner").insertAdjacentHTML("beforeend", "");
    document.getElementById("doneToggle").classList.toggle("on", done);
    document.getElementById("doneToggle").querySelector(".done-text").textContent = done ? "已完成 ✓" : "标记为已完成";
    document.getElementById("detail").innerHTML = `
      <div class="detail-head">
        <div class="detail-cat">${catName} · Hot 100 第 ${p.num} 题</div>
        <h1 class="detail-title">${p.num}. ${LC.esc(p.title_cn)} ${LC.badge(p.difficulty)}</h1>
        <div class="detail-meta">
          <span class="tag">${LC.esc(p.title_en)}</span>
          LeetCode ${p.leet_id}
          ${p.tags.map((t) => `<span class="tag">${LC.esc(t)}</span>`).join("")}
        </div>
      </div>`;
  }

  function renderStatement(st) {
    document.getElementById("detail").insertAdjacentHTML("beforeend", `
      <section class="block">
        <h2>题目描述</h2>
        <div class="statement">${st.desc.map((d) => `<p>${fmt(d)}</p>`).join("")}</div>
        ${st.examples.map((ex, i) => `
          <div class="example">
            <div class="ex-label">示例 ${i + 1}：</div>
            <pre><b>输入：</b>${LC.esc(ex.input)}\n<b>输出：</b>${LC.esc(ex.output)}${ex.explain ? `\n<b>解释：</b>${fmt(ex.explain)}` : ""}</pre>
          </div>`).join("")}
        ${st.constraints && st.constraints.length ? `
        <div class="constraints"><b>提示：</b><ul>${st.constraints.map((c) => `<li>${LC.esc(c)}</li>`).join("")}</ul></div>` : ""}
      </section>`);
  }

  function renderSolution(sol) {
    document.getElementById("detail").insertAdjacentHTML("beforeend", `
      <section class="block">
        <h2>思路讲解</h2>
        <div class="idea">${sol.idea.map((d) => `<p>${fmt(d)}</p>`).join("")}</div>
        <ol class="steps">${sol.steps.map((s) => `<li>${fmt(s)}</li>`).join("")}</ol>
      </section>
      <section class="block">
        <h2>复杂度分析</h2>
        <div class="complexity">
          <div class="cx">⏱ 时间复杂度 <b>${LC.esc(sol.complexity.time)}</b></div>
          <div class="cx">💾 空间复杂度 <b>${LC.esc(sol.complexity.space)}</b></div>
        </div>
      </section>
      <section class="block">
        <h2>Python 题解</h2>
        <div class="code-wrap">
          <button class="copy-btn">复制代码</button>
          <pre><code>${highlightPython(sol.code)}</code></pre>
        </div>
      </section>`);
    const btn = document.querySelector(".copy-btn");
    btn.addEventListener("click", async () => {
      await navigator.clipboard.writeText(sol.code).catch(() => {});
      btn.textContent = "已复制 ✓";
      setTimeout(() => (btn.textContent = "复制代码"), 1600);
    });
  }

  function renderAnim(anim) {
    document.getElementById("detail").insertAdjacentHTML("beforeend", `
      <section class="block anim-block">
        <h2>2D 算法动画讲解</h2>
        <div class="hint">▶ 播放 · 空格 播放/暂停 · ← → 单步 · 拖动进度条可跳到任意一步</div>
        <div id="animMount"></div>
      </section>`);
    new LCPlayer(document.getElementById("animMount"), anim);
  }

  function renderPager(cat, cur) {
    const flat = [];
    for (const c of cat.categories) for (const p of c.problems) flat.push(p);
    const i = flat.findIndex((p) => p.id === cur.id);
    const prev = i > 0 ? flat[i - 1] : null;
    const next = i < flat.length - 1 ? flat[i + 1] : null;
    document.getElementById("pager").innerHTML = `
      ${prev ? `<a class="prev" href="/problem/${prev.id}">← ${prev.num}. ${LC.esc(prev.title_cn)}</a>` : "<span></span>"}
      ${next ? `<a class="next" href="/problem/${next.id}">${next.num}. ${LC.esc(next.title_cn)} →</a>` : "<span></span>"}`;
  }

  function bindDoneToggle(id) {
    const t = document.getElementById("doneToggle");
    t.addEventListener("click", () => {
      const now = LC.toggleDone(id);
      t.classList.toggle("on", now);
      t.querySelector(".done-text").textContent = now ? "已完成 ✓" : "标记为已完成";
    });
  }

  init().catch((e) => {
    document.getElementById("detail").innerHTML = `<div class="loading">加载失败：${LC.esc(e.message)}</div>`;
  });
})();
