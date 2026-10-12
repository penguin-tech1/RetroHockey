// Synthesized 16-Bit Arena Audio & Tuxedo Penguin Announcer (100% Web Audio API + SpeechSynthesis)

class RetroAudioEngine {
  private ctx: AudioContext | null = null;
  public soundEnabled = true;
  public announcerEnabled = true;

  private ensureContext(): AudioContext | null {
    if (!this.soundEnabled) return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public announce(phrase: string, priority = false) {
    if (!this.announcerEnabled) return;
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return;
    try {
      if (priority) {
        window.speechSynthesis.cancel();
      }
      const utter = new SpeechSynthesisUtterance(phrase);
      utter.rate = 1.08;
      utter.pitch = 0.92;
      utter.volume = 0.9;
      window.speechSynthesis.speak(utter);
    } catch {
      // Ignore synthesis errors in restricted contexts
    }
  }

  public playIntroTagline() {
    this.playOrganCharge();
    this.announce("Tuxedo Penguin Gaming Sports — It's in the game!", true);
  }

  // 16-Bit Arcade Intro Fanfare with arpeggiated boot chimes & studio announcement
  public playIntroFanfare() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const arp = [392.0, 523.25, 659.25, 783.99, 1046.5];
    arp.forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + idx * 0.06);
      gain.gain.setValueAtTime(0.14, now + idx * 0.06);
      gain.gain.exponentialRampToValueAtTime(0.005, now + idx * 0.06 + 0.32);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + idx * 0.06);
      osc.stop(now + idx * 0.06 + 0.34);
    });

    window.setTimeout(() => {
      this.playOrganCharge();
      this.announce("Tuxedo Penguin Gaming Sports — It's in the game!", true);
    }, 400);
  }

  // Crisp ice carving / snow spray noise burst
  public playSkateCarve(intensity = 0.5) {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const duration = 0.14;
    const bufferSize = Math.floor(ctx.sampleRate * duration);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.45));
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(2400, ctx.currentTime);
    filter.Q.setValueAtTime(1.8, ctx.currentTime);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.08 * intensity, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.005, ctx.currentTime + duration);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    noise.start();
  }

  // Stick pass or wrist shot thwack
  public playPuckStick(power = 0.6) {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    const startFreq = 190 + power * 130;
    osc.frequency.setValueAtTime(startFreq, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(48, ctx.currentTime + 0.085);

    gain.gain.setValueAtTime(0.22 * Math.min(1.2, power + 0.3), ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.005, ctx.currentTime + 0.09);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.095);
  }

  // Heavy 100+ mph Slap Shot / One-Timer boom
  public playSlapShotBlast(isOneTimer = false) {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = isOneTimer ? 'sawtooth' : 'square';
    osc.frequency.setValueAtTime(isOneTimer ? 340 : 260, now);
    osc.frequency.exponentialRampToValueAtTime(38, now + 0.16);

    gain.gain.setValueAtTime(0.32, now);
    gain.gain.exponentialRampToValueAtTime(0.008, now + 0.17);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.18);
  }

  // Steel Goalpost Ping!
  public playPostPing() {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const freqs = [1480, 2210, 2960];
    freqs.forEach((f, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(f, now);
      gain.gain.setValueAtTime(0.18 / (idx + 1), now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.55);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.56);
    });
    this.announce('Off the post!', true);
  }

  // Heavy Body Check into Plexiglass Boards
  public playBoardSmash(shatterGlass = false) {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    // Low thud
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(115, now);
    osc.frequency.exponentialRampToValueAtTime(28, now + 0.22);
    gain.gain.setValueAtTime(0.4, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.24);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.25);

    // Glass rattle or shatter burst
    const dur = shatterGlass ? 0.45 : 0.18;
    const bufSize = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, bufSize, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufSize * 0.35));
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buf;

    const filter = ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(shatterGlass ? 1800 : 900, now);

    const nGain = ctx.createGain();
    nGain.gain.setValueAtTime(shatterGlass ? 0.35 : 0.16, now);
    nGain.gain.exponentialRampToValueAtTime(0.005, now + dur);

    noise.connect(filter);
    filter.connect(nGain);
    nGain.connect(ctx.destination);
    noise.start(now);
  }

  // Referee Whistle (Tuxedo Penguin Referee)
  public playWhistle() {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const lfo = ctx.createOscillator();
    const lfoGain = ctx.createGain();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(2850, now);

    lfo.type = 'sine';
    lfo.frequency.setValueAtTime(42, now);
    lfoGain.gain.setValueAtTime(140, now);

    lfo.connect(lfoGain);
    lfoGain.connect(osc.frequency);

    gain.gain.setValueAtTime(0.18, now);
    gain.gain.setValueAtTime(0.18, now + 0.25);
    gain.gain.exponentialRampToValueAtTime(0.005, now + 0.38);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(now);
    lfo.start(now);
    osc.stop(now + 0.4);
    lfo.stop(now + 0.4);
  }

  // Loud Reverberating Stadium Air Goal Horn + Crowd Roar
  public playGoalHorn() {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const chord = [130.81, 164.81, 196.0, 261.63]; // Deep brassy C-major/minor stadium horn
    chord.forEach((freq) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, now);

      gain.gain.setValueAtTime(0.01, now);
      gain.gain.linearRampToValueAtTime(0.11, now + 0.08);
      gain.gain.setValueAtTime(0.11, now + 1.4);
      gain.gain.exponentialRampToValueAtTime(0.002, now + 2.1);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 2.15);
    });

    this.announce('He shoots... SCORES!', true);
  }

  // Goalie Glove Save cue
  public playGoalieSave(announceSave = false) {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(320, now);
    osc.frequency.exponentialRampToValueAtTime(110, now + 0.11);

    gain.gain.setValueAtTime(0.22, now);
    gain.gain.exponentialRampToValueAtTime(0.005, now + 0.12);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.13);

    if (announceSave) {
      this.announce('Great save by the netminder!', false);
    }
  }

  // Classic Stadium Organ "Charge!" Riff
  public playOrganCharge() {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const notes = [
      { f: 261.63, t: 0.0, d: 0.12 },
      { f: 329.63, t: 0.13, d: 0.12 },
      { f: 392.0, t: 0.26, d: 0.12 },
      { f: 523.25, t: 0.39, d: 0.24 },
      { f: 392.0, t: 0.65, d: 0.14 },
      { f: 523.25, t: 0.81, d: 0.45 },
    ];

    notes.forEach((n) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.setValueAtTime(n.f, now + n.t);

      gain.gain.setValueAtTime(0.08, now + n.t);
      gain.gain.exponentialRampToValueAtTime(0.005, now + n.t + n.d);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + n.t);
      osc.stop(now + n.t + n.d + 0.02);
    });
  }

  // Foil Card Pack Open fanfare
  public playPackOpenChime(isHighTier = false) {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const freqs = isHighTier
      ? [523.25, 659.25, 783.99, 1046.5, 1318.5]
      : [440, 554.37, 659.25, 880];

    freqs.forEach((f, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(f, now + idx * 0.07);
      gain.gain.setValueAtTime(0.14, now + idx * 0.07);
      gain.gain.exponentialRampToValueAtTime(0.003, now + idx * 0.07 + 0.35);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + idx * 0.07);
      osc.stop(now + idx * 0.07 + 0.36);
    });
  }
}

export const retroAudio = new RetroAudioEngine();
