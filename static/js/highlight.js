/* 轻量 Python 语法高亮（零依赖，单遍 tokenizer） */
window.highlightPython = (function () {
  const KEYWORDS = /^(?:def|class|return|if|elif|else|for|while|in|not|and|or|import|from|as|None|True|False|self|lambda|yield|with|break|continue|pass|is|del|global|nonlocal|assert|try|except|finally|raise|async|await)\b/;
  const BUILTINS = /^(?:len|range|print|min|max|sum|abs|sorted|reversed|set|list|dict|tuple|map|filter|enumerate|zip|str|int|float|bool|any|all|ord|chr|round|divmod|isinstance|hasattr|getattr|setattr|super|type|next|iter|pow|hash|frozenset|bytearray|bytes|format|vars|dir|id|input|open|exit)\b/;
  const TYPES = /^(?:ListNode|TreeNode|Node|Optional|List|Dict|Set|Tuple|Deque|DefaultDict|Counter|HeapQ|heapq|collections|defaultdict|deque|Counter|itertools|math|inf|Solution)\b/;

  function esc(s) {
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  function tokenize(code) {
    let out = "", i = 0;
    const n = code.length;
    const push = (cls, text) => { out += `<span class="tok-${cls}">${esc(text)}</span>`; };
    while (i < n) {
      const rest = code.slice(i);
      let m;
      if ((m = rest.match(/^#[^\n]*/))) { push("com", m[0]); i += m[0].length; continue; }
      if ((m = rest.match(/^("""[\s\S]*?"""|'''[\s\S]*?''')/))) { push("str", m[0]); i += m[0].length; continue; }
      if ((m = rest.match(/^(?:f|r|b|u|fr|rf)?("(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*')/))) { push("str", m[0]); i += m[0].length; continue; }
      if ((m = rest.match(/^@[A-Za-z_][\w.]*/))) { push("dec", m[0]); i += m[0].length; continue; }
      if ((m = rest.match(/^\d+(?:\.\d+)?(?:e[+-]?\d+)?/i))) { push("num", m[0]); i += m[0].length; continue; }
      if ((m = rest.match(/^[A-Za-z_]\w*/))) {
        const w = m[0];
        if (KEYWORDS.test(w)) push("kw", w);
        else if (TYPES.test(w)) push("bi", w);
        else if (BUILTINS.test(w)) push("bi", w);
        else if (code[i + w.length] === "(") push("fn", w);
        else out += esc(w);
        i += w.length; continue;
      }
      out += esc(code[i]); i++;
    }
    return out;
  }

  return function (code) { return tokenize(code.replace(/\r/g, "")); };
})();
