const Celebration = {
  canvas: null,
  ctx: null,
  particles: [],
  raf: 0,
  running: false,

  start() {
    this.canvas = document.getElementById("confetti-canvas");
    if (!this.canvas) return;
    this.ctx = this.canvas.getContext("2d");
    this._resize();
    this.particles = [];
    const count = window.innerWidth < 640 ? 90 : 140;
    for (let i = 0; i < count; i += 1) {
      this.particles.push(this._particle());
    }
    this.running = true;
    cancelAnimationFrame(this.raf);
    this._tick();
    this._spawnClaps();
    window.addEventListener("resize", this._resizeBound);
  },

  stop() {
    this.running = false;
    cancelAnimationFrame(this.raf);
    window.removeEventListener("resize", this._resizeBound);
    if (this.ctx && this.canvas) {
      this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    }
    const layer = document.getElementById("clap-layer");
    if (layer) layer.innerHTML = "";
  },

  _resizeBound: null,

  _resize() {
    if (!this.canvas) return;
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
  },

  _particle() {
    const colors = ["#ff6b6b", "#ffd93d", "#6bcb77", "#4d96ff", "#ff9cee", "#ffffff", "#c77dff"];
    return {
      x: Math.random() * window.innerWidth,
      y: -20 - Math.random() * window.innerHeight,
      w: 6 + Math.random() * 8,
      h: 8 + Math.random() * 10,
      color: colors[Math.floor(Math.random() * colors.length)],
      speed: 1.4 + Math.random() * 3.2,
      drift: -1 + Math.random() * 2,
      rot: Math.random() * Math.PI,
      rotSpeed: -0.12 + Math.random() * 0.24
    };
  },

  _tick() {
    if (!this.running || !this.ctx) return;
    const { ctx, canvas } = this;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    this.particles.forEach((p) => {
      p.y += p.speed;
      p.x += p.drift;
      p.rot += p.rotSpeed;
      if (p.y > canvas.height + 20) {
        p.y = -20;
        p.x = Math.random() * canvas.width;
      }
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
    });
    this.raf = requestAnimationFrame(() => this._tick());
  },

  _spawnClaps() {
    const layer = document.getElementById("clap-layer");
    if (!layer) return;
    layer.innerHTML = "";
    const count = window.innerWidth < 640 ? 18 : 28;
    for (let i = 0; i < count; i += 1) {
      const el = document.createElement("span");
      el.className = "clap";
      el.textContent = "👏";
      el.style.left = `${Math.random() * 92}%`;
      el.style.top = `${8 + Math.random() * 78}%`;
      el.style.fontSize = `${22 + Math.random() * 36}px`;
      el.style.setProperty("--rot", `${-40 + Math.random() * 80}deg`);
      el.style.animationDelay = `${Math.random() * 0.8}s`;
      el.style.animationDuration = `${1.6 + Math.random() * 1.4}s`;
      layer.appendChild(el);
    }
  }
};

Celebration._resizeBound = () => Celebration._resize();
