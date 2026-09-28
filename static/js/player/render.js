/* LCRender - SVG 渲染：shape 数组 → DOM，帧间按 key diff + CSS 过渡。 */
window.LCRender = (function () {
  const NS = "http://www.w3.org/2000/svg";
  const FADE_MS = 320;

  function el(tag, attrs) {
    const e = document.createElementNS(NS, tag);
    for (const [k, v] of Object.entries(attrs || {})) e.setAttribute(k, v);
    return e;
  }

  function buildShape(s) {
    const g = el("g", { class: "shape", "data-key": s.key });
    g.style.opacity = "0";
    let child;
    if (s.tag === "rect") {
      child = el("rect", { x: 0, y: 0, width: s.w, height: s.h, rx: s.rx || 0, fill: s.fill, stroke: s.stroke || "none", "stroke-width": s.sw || 0 });
      if (s.dash) child.setAttribute("stroke-dasharray", s.dash);
    } else if (s.tag === "circle") {
      child = el("circle", { cx: 0, cy: 0, r: s.r, fill: s.fill, stroke: s.stroke || "none", "stroke-width": s.sw || 0 });
    } else if (s.tag === "text") {
      child = el("text", { x: 0, y: 0, "text-anchor": s.anchor || "middle", "dominant-baseline": "middle", fill: s.fill, "font-size": s.fs, "font-weight": s.fw || 400 });
      child.textContent = s.t;
      if (s.italic) child.setAttribute("font-style", "italic");
    } else if (s.tag === "line") {
      child = el("line", { x1: 0, y1: 0, x2: s.dx, y2: s.dy, stroke: s.stroke, "stroke-width": s.sw, "stroke-linecap": "round" });
    } else if (s.tag === "path") {
      child = el("path", { d: s.d, fill: s.fill || "none", stroke: s.stroke || "none", "stroke-width": s.sw || 0 });
    }
    g.appendChild(child);
    g.style.transform = `translate(${s.x}px, ${s.y}px)`;
    return g;
  }

  function applyAttrs(g, s) {
    const c = g.firstChild;
    if (s.tag === "rect") {
      if (+c.getAttribute("width") !== s.w) c.setAttribute("width", s.w);
      if (+c.getAttribute("height") !== s.h) c.setAttribute("height", s.h);
      c.setAttribute("rx", s.rx || 0);
      c.setAttribute("fill", s.fill); c.setAttribute("stroke", s.stroke || "none"); c.setAttribute("stroke-width", s.sw || 0);
    } else if (s.tag === "circle") {
      c.setAttribute("r", s.r); c.setAttribute("fill", s.fill); c.setAttribute("stroke", s.stroke || "none"); c.setAttribute("stroke-width", s.sw || 0);
    } else if (s.tag === "text") {
      const old = c.textContent;
      if (old !== s.t) { c.textContent = s.t; g.classList.add("flash"); setTimeout(() => g.classList.remove("flash"), 500); }
      c.setAttribute("fill", s.fill); c.setAttribute("font-size", s.fs); c.setAttribute("font-weight", s.fw || 400);
      c.setAttribute("text-anchor", s.anchor || "middle");
    } else if (s.tag === "line") {
      c.setAttribute("x2", s.dx); c.setAttribute("y2", s.dy); c.setAttribute("stroke", s.stroke); c.setAttribute("stroke-width", s.sw);
    } else if (s.tag === "path") {
      c.setAttribute("d", s.d); c.setAttribute("fill", s.fill || "none"); c.setAttribute("stroke", s.stroke || "none");
    }
    g.style.transform = `translate(${s.x}px, ${s.y}px)`;
  }

  class Renderer {
    constructor(svg) {
      this.svg = svg;
      this.map = new Map(); // key -> <g>
    }
    render(shapes, height) {
      this.svg.setAttribute("viewBox", `0 0 ${LCLayout.W} ${Math.max(height, 120)}`);
      const seen = new Set();
      for (const s of shapes) {
        seen.add(s.key);
        const g = this.map.get(s.key);
        if (!g) {
          const ng = buildShape(s);
          this.svg.appendChild(ng);
          this.map.set(s.key, ng);
          requestAnimationFrame(() => requestAnimationFrame(() => { ng.style.opacity = "1"; }));
        } else {
          applyAttrs(g, s);
        }
      }
      const dead = [];
      for (const [key, g] of this.map) {
        if (!seen.has(key)) { g.style.opacity = "0"; dead.push(key); }
      }
      if (dead.length) setTimeout(() => {
        for (const key of dead) {
          const g = this.map.get(key);
          if (g && !seen.has(key) && g.style.opacity === "0") { g.remove(); this.map.delete(key); }
        }
      }, FADE_MS);
    }
    clear() { this.svg.innerHTML = ""; this.map.clear(); }
  }

  return { Renderer };
})();
