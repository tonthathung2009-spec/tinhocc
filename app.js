const App = {
  screen: "home",
  selectedSong: null,
  currentNoteIndex: 0,
  isPaused: false,
  isCompleted: false,
  lastNote: null,
  feedbackTimer: 0,

  init() {
    this._spawnBackgroundNotes();
    this._buildVolumeControls();
    this._buildSongCards();
    Piano.create();
    Piano.bindKeyboard();
    Piano.onNote = (note) => this.handleNote(note);

    document.getElementById("btn-free-play").addEventListener("click", () => this.goFreePlay());
    document.getElementById("btn-learn-song").addEventListener("click", () => this.goSongs());
    document.getElementById("free-play-home").addEventListener("click", () => this.goHome());
    document.getElementById("songs-home").addEventListener("click", () => this.goHome());
    document.getElementById("learn-exit").addEventListener("click", () => this.exitLearn());
    document.getElementById("btn-pause").addEventListener("click", () => this.pause());
    document.getElementById("btn-resume").addEventListener("click", () => this.resume());
    document.getElementById("btn-restart").addEventListener("click", () => this.restart());
    document.getElementById("btn-play-again").addEventListener("click", () => this.playAgain());
    document.getElementById("btn-choose-song").addEventListener("click", () => this.chooseAnother());
    document.getElementById("btn-complete-free").addEventListener("click", () => this.completeToFreePlay());

    document.addEventListener("pointerdown", () => AudioEngine.init(), { once: true });
    document.addEventListener("keydown", () => AudioEngine.init(), { once: true });
  },

  _spawnBackgroundNotes() {
    const layer = document.querySelector(".bg-notes");
    const glyphs = ["♪", "♫", "♩", "♬", "🎹", "✦"];
    for (let i = 0; i < 18; i += 1) {
      const n = document.createElement("span");
      n.className = "float-note";
      n.textContent = glyphs[i % glyphs.length];
      n.style.left = `${4 + Math.random() * 92}%`;
      n.style.animationDelay = `${-Math.random() * 16}s`;
      n.style.animationDuration = `${14 + Math.random() * 10}s`;
      n.style.fontSize = `${16 + Math.random() * 22}px`;
      layer.appendChild(n);
    }
  },

  _buildVolumeControls() {
    ["volume-free", "volume-learn"].forEach((id) => {
      const slot = document.getElementById(id);
      slot.innerHTML = `
        <div class="volume">
          <button class="mute-btn" type="button" aria-label="Mute piano">🔊</button>
          <label class="volume-label">
            Volume
            <input class="volume-slider" type="range" min="0" max="100" value="72" aria-label="Piano volume" />
          </label>
        </div>
      `;
      const mute = slot.querySelector(".mute-btn");
      const slider = slot.querySelector(".volume-slider");
      mute.addEventListener("click", () => {
        AudioEngine.setMuted(!AudioEngine.muted);
        this._syncVolumeUI();
      });
      slider.addEventListener("input", () => {
        const value = Number(slider.value) / 100;
        AudioEngine.setVolume(value);
        if (value === 0) AudioEngine.setMuted(true);
        else if (AudioEngine.muted) AudioEngine.setMuted(false);
        this._syncVolumeUI();
      });
    });
    this._syncVolumeUI();
  },

  _syncVolumeUI() {
    document.querySelectorAll(".mute-btn").forEach((btn) => {
      btn.textContent = AudioEngine.muted || AudioEngine.volume === 0 ? "🔇" : "🔊";
      btn.setAttribute("aria-label", AudioEngine.muted ? "Unmute piano" : "Mute piano");
    });
    document.querySelectorAll(".volume-slider").forEach((slider) => {
      slider.value = String(Math.round(AudioEngine.volume * 100));
    });
  },

  _buildSongCards() {
    const grid = document.getElementById("song-grid");
    grid.innerHTML = "";
    SONGS.forEach((song) => {
      const card = document.createElement("article");
      card.className = `song-card${song.featured ? " featured" : ""}`;
      card.innerHTML = `
        <p class="song-emoji">${song.emoji}</p>
        <h3>${song.title}</h3>
        <p class="difficulty">${song.difficulty}</p>
        <p class="song-desc">${song.description}</p>
        <button class="btn ${song.featured ? "btn-primary" : "btn-secondary"}" type="button">
          Start Learning
        </button>
      `;
      card.querySelector("button").addEventListener("click", () => this.startSong(song.id));
      grid.appendChild(card);
    });
  },

  showScreen(name) {
    this.screen = name;
    document.querySelectorAll(".screen").forEach((el) => {
      const active = el.id === `screen-${name}`;
      el.classList.toggle("active", active);
      el.hidden = !active;
      el.setAttribute("aria-hidden", active ? "false" : "true");
      if ("inert" in el) el.inert = !active;
    });
  },

  goHome() {
    this.isPaused = false;
    this._hideOverlays();
    Celebration.stop();
    Piano.releaseAll();
    Piano.setHint(null);
    this.showScreen("home");
  },

  goFreePlay() {
    this.isPaused = false;
    this.isCompleted = false;
    this._hideOverlays();
    Celebration.stop();
    this.showScreen("free-play");
    Piano.attach(document.getElementById("piano-host-free"));
    Piano.setKeymapVisible(true);
    Piano.setHint(null);
    this._updateCurrentNote(this.lastNote);
    requestAnimationFrame(() => Piano._positionBlackKeys());
  },

  goSongs() {
    this.isPaused = false;
    this._hideOverlays();
    Celebration.stop();
    Piano.releaseAll();
    Piano.setHint(null);
    this.showScreen("songs");
  },

  startSong(id) {
    const song = SONGS.find((s) => s.id === id);
    if (!song) return;
    this.selectedSong = song;
    this.currentNoteIndex = 0;
    this.isPaused = false;
    this.isCompleted = false;
    this._hideOverlays();
    Celebration.stop();
    document.getElementById("learn-title").textContent = `${song.emoji} ${song.title}`;
    document.getElementById("btn-pause").textContent = "Pause";
    this.showScreen("learn");
    Piano.attach(document.getElementById("piano-host-learn"));
    Piano.setKeymapVisible(false);
    this._clearFeedback();
    this._renderLearn();
    requestAnimationFrame(() => Piano._positionBlackKeys());
  },

  handleNote(note) {
    this.lastNote = note;
    if (this.screen === "free-play") this._updateCurrentNote(note);
    if (this.screen !== "learn" || this.isPaused || this.isCompleted || !this.selectedSong) return;

    const expected = this.selectedSong.notes[this.currentNoteIndex];
    if (note === expected) {
      this.currentNoteIndex += 1;
      this._clearFeedback();
      if (this.currentNoteIndex >= this.selectedSong.notes.length) {
        this.completeSong();
      } else {
        this._renderLearn();
      }
    } else {
      Piano.flashWrong(note);
      AudioEngine.playErrorSound();
      this._showFeedback("Almost! Try the glowing key.");
    }
  },

  _updateCurrentNote(note) {
    document.getElementById("current-note").textContent = `Current note: ${note || "—"}`;
  },

  _renderLearn() {
    const song = this.selectedSong;
    const total = song.notes.length;
    const done = this.currentNoteIndex;
    const next = song.notes[done];
    document.getElementById("progress-label").textContent = `${done} / ${total} notes`;
    const pct = total ? (done / total) * 100 : 0;
    document.getElementById("progress-fill").style.width = `${pct}%`;
    const bar = document.getElementById("progress-bar");
    bar.setAttribute("aria-valuenow", String(Math.round(pct)));
    bar.setAttribute("aria-valuemax", "100");
    document.getElementById("next-note-name").textContent = next || "Done";
    Piano.setHint(this.isPaused || this.isCompleted ? null : next);

    const upcoming = document.getElementById("upcoming-notes");
    upcoming.innerHTML = "";
    song.notes.slice(done, done + 4).forEach((n, i) => {
      const chip = document.createElement("span");
      chip.className = `chip${i === 0 ? " current" : ""}`;
      chip.textContent = n;
      upcoming.appendChild(chip);
      if (i < 3 && done + i + 1 < song.notes.length) {
        const arrow = document.createElement("span");
        arrow.className = "chip-arrow";
        arrow.textContent = "→";
        upcoming.appendChild(arrow);
      }
    });
  },

  _showFeedback(text) {
    const el = document.getElementById("learn-feedback");
    el.textContent = text;
    el.classList.add("show");
    clearTimeout(this.feedbackTimer);
    this.feedbackTimer = window.setTimeout(() => this._clearFeedback(), 1600);
  },

  _clearFeedback() {
    const el = document.getElementById("learn-feedback");
    el.textContent = "";
    el.classList.remove("show");
  },

  pause() {
    if (this.screen !== "learn" || this.isCompleted) return;
    this.isPaused = true;
    Piano.setHint(this.selectedSong.notes[this.currentNoteIndex]);
    document.getElementById("pause-overlay").hidden = false;
  },

  resume() {
    this.isPaused = false;
    document.getElementById("pause-overlay").hidden = true;
    this._renderLearn();
  },

  restart() {
    if (!this.selectedSong) return;
    this.currentNoteIndex = 0;
    this.isPaused = false;
    this.isCompleted = false;
    this._hideOverlays();
    Celebration.stop();
    this._clearFeedback();
    this._renderLearn();
  },

  completeSong() {
    this.isCompleted = true;
    this.isPaused = false;
    Piano.setHint(null);
    document.getElementById("progress-label").textContent =
      `${this.selectedSong.notes.length} / ${this.selectedSong.notes.length} notes`;
    document.getElementById("progress-fill").style.width = "100%";
    document.getElementById("complete-sub").textContent =
      `You completed ${this.selectedSong.title}!`;
    document.getElementById("complete-overlay").hidden = false;
    try {
      AudioEngine.playVictorySound();
      window.setTimeout(() => AudioEngine.playApplause(), 280);
    } catch (_e) {}
    Celebration.start();
  },

  playAgain() {
    this.restart();
  },

  chooseAnother() {
    this._hideOverlays();
    Celebration.stop();
    this.goSongs();
  },

  completeToFreePlay() {
    this._hideOverlays();
    Celebration.stop();
    this.goFreePlay();
  },

  exitLearn() {
    this._hideOverlays();
    Celebration.stop();
    this.goSongs();
  },

  _hideOverlays() {
    document.getElementById("pause-overlay").hidden = true;
    document.getElementById("complete-overlay").hidden = true;
  }
};

document.addEventListener("DOMContentLoaded", () => App.init());
