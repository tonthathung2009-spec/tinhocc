const PIANO_NOTES = [
  "C4", "C#4", "D4", "D#4", "E4", "F4", "F#4", "G4", "G#4", "A4", "A#4", "B4",
  "C5", "C#5", "D5", "D#5", "E5", "F5", "F#5", "G5", "G#5", "A5", "A#5", "B5",
  "C6"
];

const KEYBOARD_MAP = {
  a: "C4", w: "C#4", s: "D4", e: "D#4", d: "E4",
  f: "F4", t: "F#4", g: "G4", y: "G#4", h: "A4", u: "A#4", j: "B4",
  k: "C5", o: "C#5", l: "D5", p: "D#5", ";": "E5", "'": "F5", "[": "F#5",
  z: "G5", x: "G#5", c: "A5", v: "A#5", b: "B5", n: "C6"
};

const NOTE_TO_KEY = Object.fromEntries(
  Object.entries(KEYBOARD_MAP).map(([k, note]) => [note, k.toUpperCase()])
);

const WHITE_NOTES = PIANO_NOTES.filter((n) => !n.includes("#"));

const Piano = {
  root: null,
  showKeymap: true,
  heldPointer: new Map(),
  heldKeyboard: new Map(),
  onNote: null,

  create() {
    this.root = document.createElement("div");
    this.root.className = "piano";
    this.root.setAttribute("role", "group");
    this.root.setAttribute("aria-label", "Two-octave piano from C4 to C6");

    const whites = document.createElement("div");
    whites.className = "piano-whites";
    WHITE_NOTES.forEach((note) => whites.appendChild(this._makeKey(note, false)));
    this.root.appendChild(whites);

    const blacks = document.createElement("div");
    blacks.className = "piano-blacks";
    PIANO_NOTES.filter((n) => n.includes("#")).forEach((note) => {
      blacks.appendChild(this._makeKey(note, true));
    });
    this.root.appendChild(blacks);

    this._positionBlackKeys();
    this._bindPointer();
    if (typeof ResizeObserver !== "undefined") {
      new ResizeObserver(() => this._positionBlackKeys()).observe(this.root);
    }
    return this.root;
  },

  attach(host) {
    if (!this.root) this.create();
    host.appendChild(this.root);
    this._positionBlackKeys();
  },

  setKeymapVisible(visible) {
    this.showKeymap = visible;
    if (!this.root) return;
    this.root.querySelectorAll(".key-kbd").forEach((el) => {
      el.hidden = !visible;
    });
  },

  setHint(note) {
    if (!this.root) return;
    this.root.querySelectorAll(".key.hint").forEach((el) => el.classList.remove("hint"));
    if (!note) return;
    const key = this.root.querySelector(`[data-note="${note}"]`);
    if (key) key.classList.add("hint");
  },

  flashWrong(note) {
    const key = this.root && this.root.querySelector(`[data-note="${note}"]`);
    if (!key) return;
    key.classList.remove("wrong");
    void key.offsetWidth;
    key.classList.add("wrong");
    window.setTimeout(() => key.classList.remove("wrong"), 420);
  },

  pressVisual(note, down) {
    const key = this.root && this.root.querySelector(`[data-note="${note}"]`);
    if (!key) return;
    key.classList.toggle("active", down);
  },

  _makeKey(note, isBlack) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `key ${isBlack ? "black" : "white"}`;
    btn.dataset.note = note;
    btn.setAttribute("aria-label", `Piano key ${note}`);

    const marker = document.createElement("span");
    marker.className = "key-marker";
    marker.textContent = "✦";
    marker.setAttribute("aria-hidden", "true");

    const name = document.createElement("span");
    name.className = "key-note";
    name.textContent = note;

    const kbd = document.createElement("span");
    kbd.className = "key-kbd";
    kbd.textContent = NOTE_TO_KEY[note] ? `[${NOTE_TO_KEY[note]}]` : "";
    if (!NOTE_TO_KEY[note]) kbd.hidden = true;

    btn.append(marker, name, kbd);
    return btn;
  },

  _positionBlackKeys() {
    if (!this.root) return;
    const whites = this.root.querySelector(".piano-whites");
    if (!whites) return;
    const whiteWidth = whites.clientWidth / WHITE_NOTES.length;
    const blackWidth = whiteWidth * 0.62;

    this.root.querySelectorAll(".key.black").forEach((key) => {
      const note = key.dataset.note;
      const natural = note.replace("#", "");
      const idx = WHITE_NOTES.indexOf(natural);
      if (idx < 0) return;
      key.style.width = `${blackWidth}px`;
      key.style.left = `${(idx + 1) * whiteWidth - blackWidth / 2}px`;
    });
  },

  _bindPointer() {
    this.root.addEventListener("pointerdown", (event) => {
      const key = event.target.closest(".key");
      if (!key || !this.root.contains(key)) return;
      event.preventDefault();
      const note = key.dataset.note;
      this.root.setPointerCapture(event.pointerId);
      this._start(note, `p-${event.pointerId}`);
    });

    const end = (event) => {
      this._stop(`p-${event.pointerId}`);
    };
    this.root.addEventListener("pointerup", end);
    this.root.addEventListener("pointercancel", end);
    this.root.addEventListener("lostpointercapture", end);
  },

  bindKeyboard() {
    window.addEventListener("keydown", (event) => {
      if (event.repeat || event.metaKey || event.ctrlKey || event.altKey) return;
      const tag = (event.target && event.target.tagName) || "";
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      const note = KEYBOARD_MAP[event.key.toLowerCase()];
      if (!note) return;
      event.preventDefault();
      this._start(note, `k-${event.key.toLowerCase()}`);
    });
    window.addEventListener("keyup", (event) => {
      const note = KEYBOARD_MAP[event.key.toLowerCase()];
      if (!note) return;
      this._stop(`k-${event.key.toLowerCase()}`);
    });
    window.addEventListener("blur", () => this.releaseAll());
    window.addEventListener("resize", () => this._positionBlackKeys());
  },

  _start(note, token) {
    if (this.heldPointer.has(token) || this.heldKeyboard.has(token)) return;
    const voiceId = AudioEngine.playNote(note);
    this.heldPointer.set(token, { note, voiceId });
    this.pressVisual(note, true);
    if (typeof this.onNote === "function") this.onNote(note);
  },

  _stop(token) {
    const held = this.heldPointer.get(token);
    if (!held) return;
    AudioEngine.releaseNote(held.voiceId);
    this.heldPointer.delete(token);
    const stillHeld = [...this.heldPointer.values()].some((v) => v.note === held.note);
    if (!stillHeld) this.pressVisual(held.note, false);
  },

  releaseAll() {
    [...this.heldPointer.keys()].forEach((token) => this._stop(token));
  }
};
