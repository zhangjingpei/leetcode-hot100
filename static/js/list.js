/* 列表页：渲染 17 分类 100 题 + 搜索/筛选/打卡进度 */
(function () {
  const state = { cats: [], q: "", diffs: new Set() };

  async function init() {
    const data = await LC.jget("/api/catalog");
    state.cats = data.categories;
    renderNav();
    render();
    bindToolbar();
    updateProgress();
    const q = LC.param("q");
    if (q) { document.getElementById("searchBox").value = q; state.q = q; render(); }
  }

  function renderNav() {
    document.getElementById("catNav").innerHTML = state.cats
      .map((c) => `<a href="#cat-${c.id}">${c.name}·${c.count}</a>`)
      .join("");
  }

  function bindToolbar() {
    const box = document.getElementById("searchBox");
    box.addEventListener("input", () => { state.q = box.value.trim(); render(); });
    document.querySelectorAll(".chip").forEach((chip) =>
      chip.addEventListener("click", () => {
        const d = chip.dataset.diff;
        state.diffs.has(d) ? state.diffs.delete(d) : state.diffs.add(d);
        chip.classList.toggle("on");
        render();
      })
    );
  }

  function match(p) {
    if (state.diffs.size && !state.diffs.has(p.difficulty)) return false;
    if (state.q) {
      const kw = state.q.toLowerCase();
      const hay = `${p.num} ${p.leet_id} ${p.title_cn} ${p.title_en}`.toLowerCase();
      if (!hay.includes(kw)) return false;
    }
    return true;
  }

  function render() {
    const root = document.getElementById("list");
    let total = 0, html = "";
    for (const c of state.cats) {
      const ps = c.problems.filter(match);
      total += ps.length;
      html += `
        <section class="cat-section" id="cat-${c.id}">
          <div class="cat-head"><h2>${c.name}</h2><span class="cat-count">${ps.length} 题</span></div>
          <div class="grid">
            ${ps.map(pcard).join("")}
          </div>
        </section>`;
    }
    if (!total) html = `<div class="empty-tip">没有匹配的题目，换个关键词试试</div>`;
    root.innerHTML = html;
    root.querySelectorAll(".done-dot").forEach((dot) =>
      dot.addEventListener("click", (e) => {
        e.preventDefault(); e.stopPropagation();
        const id = dot.dataset.pid;
        const now = LC.toggleDone(id);
        dot.closest(".pcard").classList.toggle("done", now);
        updateProgress();
      })
    );
  }

  function pcard(p) {
    return `
      <a class="pcard ${LC.isDone(p.id) ? "done" : ""}" href="/problem/${p.id}">
        <span class="p-num">${p.num}</span>
        <div class="p-body">
          <div class="p-title">${p.num}. ${LC.esc(p.title_cn)}</div>
          <div class="p-en">${LC.esc(p.title_en)}</div>
        </div>
        ${LC.badge(p.difficulty)}
        <span class="done-dot" data-pid="${p.id}" title="标记完成"></span>
      </a>`;
  }

  function updateProgress() {
    const done = LC.doneSet().size;
    document.getElementById("progressText").textContent = `${done} / 100`;
    document.getElementById("progressFill").style.width = `${done}%`;
  }

  init().catch((e) => {
    document.getElementById("list").innerHTML = `<div class="empty-tip">加载失败：${LC.esc(e.message)}（请确认服务已启动）</div>`;
  });
})();
