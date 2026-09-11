const NOTE_FREQUENCIES = {
  C4: 261.63, "C#4": 277.18, D4: 293.66, "D#4": 311.13, E4: 329.63,
  F4: 349.23, "F#4": 369.99, G4: 392.0, "G#4": 415.3, A4: 440.0, "A#4": 466.16, B4: 493.88,
  C5: 523.25, "C#5": 554.37, D5: 587.33, "D#5": 622.25, E5: 659.25,
  F5: 698.46, "F#5": 739.99, G5: 783.99, "G#5": 830.61, A5: 880.0, "A#5": 932.33, B5: 987.77,
  C6: 1046.5
};

const AudioEngine = {
  ctx: null,
  master: null,
  compressor: null,
  volume: 0.72,
  muted: false,
  active: new Map(),
  id: 0,

  init() {
    if (this.ctx) {
      if (this.ctx.state === "suspended") {
        this.ctx.resume().catch(() => {});
      }
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try {
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : this.volume;
      this.compressor = this.ctx.createDynamicsCompressor();
      this.compressor.threshold.value = -18;
      this.compressor.knee.value = 18;
      this.compressor.ratio.value = 4;
      this.compressor.attack.value = 0.003;
      this.compressor.release.value = 0.12;
      this.master.connect(this.compressor);
      this.compressor.connect(this.ctx.destination);
    } catch (_err) {
      this.ctx = null;
    }
  },

  setVolume(value) {
    this.volume = Math.min(1, Math.max(0, Number(value) || 0));
    if (this.master && !this.muted) {
      this.master.gain.setTargetAtTime(this.volume, this.now(), 0.02);
    }
  },

  setMuted(muted) {
    this.muted = Boolean(muted);
    if (!this.master) return;
    this.master.gain.setTargetAtTime(this.muted ? 0 : this.volume, this.now(), 0.02);
  },

  now() {
    return this.ctx ? this.ctx.currentTime : 0;
  },

  playNote(note) {
    this.init();
    if (!this.ctx || !this.master) return null;
    const freq = NOTE_FREQUENCIES[note];
    if (!freq) return null;

    const voiceId = `${note}-${++this.id}`;
    const t = this.ctx.currentTime;
    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.9, t + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.38, t + 0.16);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 1.85);

    const filter = this.ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(Math.min(4200, freq * 8), t);
    filter.frequency.exponentialRampToValueAtTime(Math.min(1800, freq * 4), t + 0.35);
    filter.Q.value = 0.9;

    const harmonics = [
      { type: "triangle", ratio: 1, level: 0.72 },
      { type: "sine", ratio: 2, level: 0.22 },
      { type: "sine", ratio: 3, level: 0.1 },
      { type: "sine", ratio: 4, level: 0.05 },
      { type: "sine", ratio: 5, level: 0.03 }
    ];

    const oscs = harmonics.map((h) => {
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = h.type;
      osc.frequency.setValueAtTime(freq * h.ratio, t);
      g.gain.value = h.level;
      osc.connect(g);
      g.connect(filter);
      osc.start(t);
      osc.stop(t + 2.05);
      osc.onended = () => {
        try {
          osc.disconnect();
          g.disconnect();
        } catch (_e) {}
      };
      return osc;
    });

    filter.connect(gain);
    gain.connect(this.master);

    const voice = { note, oscs, gain, filter, startedAt: t };
    this.active.set(voiceId, voice);
    window.setTimeout(() => this._dispose(voiceId), 2100);
    return voiceId;
  },

  releaseNote(voiceId) {
    if (!voiceId || !this.ctx) return;
    const voice = this.active.get(voiceId);
    if (!voice) return;
    const t = this.ctx.currentTime;
    try {
      voice.gain.gain.cancelScheduledValues(t);
      const current = Math.max(0.0001, voice.gain.gain.value);
      voice.gain.gain.setValueAtTime(current, t);
      voice.gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
    } catch (_e) {}
  },

  _dispose(voiceId) {
    const voice = this.active.get(voiceId);
    if (!voice) return;
    try {
      voice.gain.disconnect();
      voice.filter.disconnect();
    } catch (_e) {}
    this.active.delete(voiceId);
  },

  playErrorSound() {
    this.init();
    if (!this.ctx || !this.master) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(180, t);
    osc.frequency.exponentialRampToValueAtTime(120, t + 0.12);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.08, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);
    osc.connect(g);
    g.connect(this.master);
    osc.start(t);
    osc.stop(t + 0.16);
  },

  playVictorySound() {
    this.init();
    if (!this.ctx || !this.master) return;
    const seq = [523.25, 659.25, 783.99, 1046.5];
    seq.forEach((freq, i) => {
      const t = this.ctx.currentTime + i * 0.12;
      const osc = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      osc.type = "triangle";
      osc.frequency.value = freq;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.28, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.32);
      osc.connect(g);
      g.connect(this.master);
      osc.start(t);
      osc.stop(t + 0.34);
    });
  },

  playApplause() {
    this.init();
    if (!this.ctx || !this.master) return;
    const duration = 1.8;
    const bufferSize = Math.floor(this.ctx.sampleRate * duration);
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i += 1) {
      const envelope = Math.pow(1 - i / bufferSize, 0.45);
      const burst = Math.random() > 0.55 ? Math.random() * 2 - 1 : 0;
      data[i] = burst * envelope;
    }
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;
    const filter = this.ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = 1800;
    filter.Q.value = 0.7;
    const g = this.ctx.createGain();
    g.gain.value = 0.22;
    noise.connect(filter);
    filter.connect(g);
    g.connect(this.master);
    noise.start();
    noise.stop(this.ctx.currentTime + duration);
  }
};
