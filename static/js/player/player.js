/* LCPlayer - 动画播放器：状态机 + 控制条 + 键盘快捷键。
 * 用法：new LCPlayer(containerEl, animData)
 */
(function () {
  const BASE_MS = 1500;

  class Player {
    constructor(container, animData) {
      this.snaps = window.LCAnim.materialize(animData);
      this.idx = 0;
      this.playing = false;
      this.timer = null;
      this.speed = parseFloat(localStorage.getItem("lc100.speed") || "1") || 1;

      container.innerHTML = `
        <div class="lcp">
          <div class="lcp-stage"><svg xmlns="http://www.w3.org/2000/svg"></svg></div>
          <div class="lcp-saybar"><span class="lcp-step"></span><span class="lcp-say"></span></div>
          <div class="lcp-ctrl">
            <button class="lcp-btn" data-act="first" title="首帧 (Home)">⏮</button>
            <button class="lcp-btn" data-act="prev" title="上一步 (←)">◀</button>
            <button class="lcp-btn lcp-play" data-act="toggle" title="播放/暂停 (空格)">▶</button>
            <button class="lcp-btn" data-act="next" title="下一步 (→)">▶|</button>
            <button class="lcp-btn" data-act="last" title="末帧 (End)">⏭</button>
            <input class="lcp-range" type="range" min="0" value="0" step="1">
            <span class="lcp-count"></span>
            <select class="lcp-speed" title="播放速度">
              <option value="0.5">0.5x</option><option value="1">1x</option>
              <option value="1.5">1.5x</option><option value="2">2x</option>
            </select>
          </div>
        </div>`;
      this.svg = container.querySelector("svg");
      this.renderer = new window.LCRender.Renderer(this.svg);
      this.$step = container.querySelector(".lcp-step");
      this.$say = container.querySelector(".lcp-say");
      this.$range = container.querySelector(".lcp-range");
      this.$count = container.querySelector(".lcp-count");
      this.$play = container.querySelector(".lcp-play");
      const $speed = container.querySelector(".lcp-speed");
      $speed.value = String(this.speed);

      this.$range.max = String(this.snaps.length - 1);
      this.$range.addEventListener("input", () => this.show(+this.$range.value));
      container.querySelectorAll(".lcp-btn").forEach((b) =>
        b.addEventListener("click", () => this.act(b.dataset.act))
      );
      $speed.addEventListener("change", () => {
        this.speed = parseFloat($speed.value);
        localStorage.setItem("lc100.speed", $speed.value);
        if (this.playing) this._restartTimer();
      });
      document.addEventListener("keydown", (e) => {
        const tag = (e.target.tagName || "").toLowerCase();
        if (tag === "input" || tag === "textarea" || tag === "select") return;
        if (e.key === " ") { e.preventDefault(); this.act("toggle"); }
        else if (e.key === "ArrowLeft") { e.preventDefault(); this.act("prev"); }
        else if (e.key === "ArrowRight") { e.preventDefault(); this.act("next"); }
        else if (e.key === "Home") this.act("first");
        else if (e.key === "End") this.act("last");
      });

      this.show(0);
    }

    act(a) {
      if (a === "toggle") return this.playing ? this.pause() : this.play();
      if (a === "next") return this.show(this.idx + 1);
      if (a === "prev") return this.show(this.idx - 1);
      if (a === "first") return this.show(0);
      if (a === "last") return this.show(this.snaps.length - 1);
    }

    show(i) {
      this.idx = Math.max(0, Math.min(this.snaps.length - 1, i));
      const snap = this.snaps[this.idx];
      const { shapes, height } = window.LCLayout.layoutAll(snap.views, snap.hl);
      this.renderer.render(shapes, height);
      this.$step.textContent = `${this.idx + 1}/${this.snaps.length}`;
      this.$say.textContent = snap.say;
      this.$range.value = String(this.idx);
      if (this.idx >= this.snaps.length - 1 && this.playing) this.pause();
    }

    play() {
      if (this.idx >= this.snaps.length - 1) this.show(0);
      this.playing = true;
      this.$play.textContent = "⏸";
      this._restartTimer();
    }

    pause() {
      this.playing = false;
      this.$play.textContent = "▶";
      if (this.timer) { clearInterval(this.timer); this.timer = null; }
    }

    _restartTimer() {
      if (this.timer) clearInterval(this.timer);
      this.timer = setInterval(() => {
        if (this.idx >= this.snaps.length - 1) this.pause();
        else this.show(this.idx + 1);
      }, BASE_MS / this.speed);
    }
  }

  window.LCPlayer = Player;
})();
