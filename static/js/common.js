/* 通用工具：fetch / localStorage 打卡 / 难度徽章 */
window.LC = (function () {
  async function jget(url) {
    const r = await fetch(url);
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return r.json();
  }

  const KEY = "lc100.done";
  function doneSet() { return new Set(JSON.parse(localStorage.getItem(KEY) || "[]")); }
  function isDone(id) { return doneSet().has(id); }
  function toggleDone(id) {
    const s = doneSet();
    s.has(id) ? s.delete(id) : s.add(id);
    localStorage.setItem(KEY, JSON.stringify([...s]));
    return s.has(id);
  }

  function badge(diff) { return `<span class="badge ${diff}">${diff}</span>`; }

  function esc(s) {
    return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  function param(name) { return new URLSearchParams(location.search).get(name); }

  return { jget, doneSet, isDone, toggleDone, badge, esc, param };
})();
