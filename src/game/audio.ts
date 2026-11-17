/**
 * Minimalist Nordic Electro-Acoustic Web Audio Engine:
 * - Master DynamicsCompressor + warm transparent studio bus
 * - Whisper-quiet speed-reactive electric courier van drive hum + turbine boost
 * - Nordic felt-piano / muted electric-tine arpeggio pulse + crisp Fever overdrive
 * - Precision tactile mechanical clicks, glassy harmonic celesta chimes, two-tone
 *   Scandinavian transit horn, damped birch/chassis collision thuds, and coastal gull calls.
 */
class PokoAudioEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private muted: boolean = false;

  // Continuous speed-reactive electric van drive nodes
  private engineOscA: OscillatorNode | null = null;
  private engineOscB: OscillatorNode | null = null;
  private engineFilter: BiquadFilterNode | null = null;
  private engineGain: GainNode | null = null;

  // Minimalist Nordic felt-key pulse loop timer
  private musicActive: boolean = false;
  private feverActive: boolean = false;
  private musicTimerId: number | null = null;
  private musicStep: number = 0;
  private lastAiCrashAtMs: number = 0;
  private lastPlayerCrashAtMs: number = 0;
  private lastAmbientHornAtMs: number = 0;
  private lastBirdChirpAtMs: number = 0;
  private lastRevAtMs: number = 0;

  public isMuted(): boolean {
    return this.muted;
  }

  public setMuted(mute: boolean): void {
    this.muted = mute;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setTargetAtTime(
        mute ? 0.0001 : 0.82,
        this.ctx.currentTime,
        0.03,
      );
    }
    if (mute) {
      this.silenceEngineImmediate();
    }
  }

  public toggleMute(): boolean {
    this.setMuted(!this.muted);
    if (!this.muted) {
      this.playUiClick();
    }
    return this.muted;
  }

  public setFeverMode(fever: boolean): void {
    if (this.feverActive === fever) return;
    this.feverActive = fever;
    if (this.musicActive) {
      this.restartMusicInterval();
    }
  }

  private ensureContext(): AudioContext | null {
    if (this.muted || typeof window === 'undefined') return null;
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (!AudioCtx) return null;
      this.ctx = new AudioCtx();

      const comp = this.ctx.createDynamicsCompressor();
      comp.threshold.value = -16;
      comp.knee.value = 18;
      comp.ratio.value = 3.5;
      comp.attack.value = 0.008;
      comp.release.value = 0.18;

      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.82;
      this.masterGain.connect(comp);
      comp.connect(this.ctx.destination);

      // Pre-build 0.5s warm pink noise buffer for brushed air & tactile parcel foley
      const sampleRate = this.ctx.sampleRate;
      const length = Math.floor(sampleRate * 0.5);
      const buf = this.ctx.createBuffer(1, length, sampleRate);
      const data = buf.getChannelData(0);
      let b0 = 0;
      let b1 = 0;
      let b2 = 0;
      for (let i = 0; i < length; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99765 * b0 + white * 0.099046;
        b1 = 0.963 * b1 + white * 0.2965164;
        b2 = 0.57 * b2 + white * 1.0526913;
        data[i] = (b0 + b1 + b2 + white * 0.1848) * 0.16;
      }
      this.noiseBuffer = buf;
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  private ensureEngineNodes(ctx: AudioContext): void {
    if (this.engineGain || !this.masterGain) return;

    this.engineFilter = ctx.createBiquadFilter();
    this.engineFilter.type = 'lowpass';
    this.engineFilter.frequency.value = 240;
    this.engineFilter.Q.value = 1.1;

    this.engineGain = ctx.createGain();
    this.engineGain.gain.value = 0.0001;

    // Clean Scandinavian EV motor hum (fundamental sine + soft fifth harmonic)
    this.engineOscA = ctx.createOscillator();
    this.engineOscA.type = 'sine';
    this.engineOscA.frequency.value = 82;

    this.engineOscB = ctx.createOscillator();
    this.engineOscB.type = 'triangle';
    this.engineOscB.frequency.value = 164.2;

    const subMixB = ctx.createGain();
    subMixB.gain.value = 0.22;

    this.engineOscA.connect(this.engineFilter);
    this.engineOscB.connect(subMixB);
    subMixB.connect(this.engineFilter);
    this.engineFilter.connect(this.engineGain);
    this.engineGain.connect(this.masterGain);

    this.engineOscA.start();
    this.engineOscB.start();
  }

  private silenceEngineImmediate(): void {
    if (this.engineGain && this.ctx) {
      this.engineGain.gain.setTargetAtTime(0.0001, this.ctx.currentTime, 0.04);
    }
  }

  public updateEngine(speed: number, isBoosting: boolean, isPlaying: boolean): void {
    if (this.muted || !isPlaying) {
      this.silenceEngineImmediate();
      return;
    }
    if (!this.ctx || this.ctx.state !== 'running') return;
    this.ensureEngineNodes(this.ctx);
    if (!this.engineOscA || !this.engineOscB || !this.engineFilter || !this.engineGain) {
      return;
    }

    const now = this.ctx.currentTime;
    const norm = Math.min(1.4, Math.max(0, speed / 8.6));
    const baseFreq = 76 + norm * 88 + (isBoosting ? 42 : 0);
    const cutoff = 210 + norm * 420 + (isBoosting ? 340 : 0);
    const targetVol = 0.012 + norm * 0.024 + (isBoosting ? 0.014 : 0);

    this.engineOscA.frequency.setTargetAtTime(baseFreq, now, 0.06);
    this.engineOscB.frequency.setTargetAtTime(baseFreq * 1.998, now, 0.06);
    this.engineFilter.frequency.setTargetAtTime(cutoff, now, 0.07);
    this.engineGain.gain.setTargetAtTime(targetVol, now, 0.06);
  }

  private restartMusicInterval(): void {
    if (typeof window === 'undefined') return;
    if (this.musicTimerId !== null) {
      window.clearInterval(this.musicTimerId);
      this.musicTimerId = null;
    }
    if (!this.musicActive) return;

    // Minimalist Nordic Lydian/Dorian arpeggio motif (Olafur Arnalds / OP-1 inspired)
    const progression = [
      [293.66, 440.0, 523.25, 659.25, 587.33, 440.0, 523.25, 392.0], // Dm9
      [261.63, 392.0, 493.88, 587.33, 659.25, 493.88, 392.0, 329.63], // Cmaj9
      [233.08, 349.23, 440.0, 523.25, 587.33, 440.0, 349.23, 293.66], // Bbmaj9
      [220.0, 329.63, 392.0, 493.88, 523.25, 392.0, 329.63, 293.66], // Am7add11
    ];

    const stepMs = this.feverActive ? 175 : 245;
    this.musicTimerId = window.setInterval(() => {
      if (!this.musicActive || this.muted || !this.ctx || this.ctx.state !== 'running') {
        return;
      }
      const bar = Math.floor(this.musicStep / 8) % progression.length;
      const beat = this.musicStep % 8;
      this.musicStep++;

      if (!this.feverActive && beat === 6) return;
      const noteFreq = progression[bar][beat];
      const accent = beat === 0 || beat === 3 ? 0.032 : 0.019;
      this.playFeltKeyNote(noteFreq, accent);
      if (this.feverActive && (beat === 2 || beat === 5)) {
        this.playFeltKeyNote(noteFreq * 2, 0.013);
      }
      if (beat === 0) {
        this.playTone(noteFreq * 0.5, 0.42, 'sine', 0.032, 0);
      }
    }, stepMs);
  }

  public setMusicPlaying(active: boolean): void {
    if (this.musicActive === active) return;
    this.musicActive = active;

    if (!active) {
      if (this.musicTimerId !== null && typeof window !== 'undefined') {
        window.clearInterval(this.musicTimerId);
        this.musicTimerId = null;
      }
      this.feverActive = false;
      this.silenceEngineImmediate();
      return;
    }

    this.restartMusicInterval();
  }

  private playFeltKeyNote(freq: number, gainPeak: number): void {
    if (!this.ctx || !this.masterGain || this.muted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const tine = this.ctx.createOscillator();
    const filter = this.ctx.createBiquadFilter();
    const gain = this.ctx.createGain();
    const tineGain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now);
    tine.type = 'triangle';
    tine.frequency.setValueAtTime(freq * 2, now);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1600, now);
    filter.frequency.exponentialRampToValueAtTime(580, now + 0.32);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(gainPeak, now + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.34);

    tineGain.gain.setValueAtTime(0.0001, now);
    tineGain.gain.linearRampToValueAtTime(gainPeak * 0.22, now + 0.006);
    tineGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.09);

    osc.connect(filter);
    tine.connect(tineGain);
    tineGain.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    osc.start(now);
    tine.start(now);
    osc.stop(now + 0.36);
    tine.stop(now + 0.11);
  }

  private playTone(
    freq: number,
    duration: number,
    type: OscillatorType = 'sine',
    gainPeak: number = 0.11,
    delay: number = 0,
    slideToFreq?: number,
  ): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain) return;

    const now = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = this.createGainWithEnvelope(ctx, now, duration, gainPeak);

    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (slideToFreq) {
      osc.frequency.exponentialRampToValueAtTime(
        Math.max(24, slideToFreq),
        now + duration,
      );
    }

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(
      type === 'sawtooth' || type === 'square' ? 1400 : 3400,
      now,
    );

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    osc.start(now);
    osc.stop(now + duration + 0.025);
  }

  private createGainWithEnvelope(
    ctx: AudioContext,
    now: number,
    duration: number,
    gainPeak: number,
  ): GainNode {
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(gainPeak, now + 0.009);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    return gain;
  }

  private playFilteredNoise(
    duration: number,
    filterType: BiquadFilterType,
    startFreq: number,
    endFreq: number,
    q: number,
    gainPeak: number,
    delay: number = 0,
  ): void {
    const ctx = this.ensureContext();
    if (!ctx || !this.masterGain || !this.noiseBuffer) return;

    const now = ctx.currentTime + delay;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuffer;

    const filter = ctx.createBiquadFilter();
    filter.type = filterType;
    filter.Q.value = q;
    filter.frequency.setValueAtTime(startFreq, now);
    filter.frequency.exponentialRampToValueAtTime(Math.max(40, endFreq), now + duration);

    const gain = this.createGainWithEnvelope(ctx, now, duration, gainPeak);

    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    src.start(now);
    src.stop(now + duration + 0.02);
  }

  public playUiClick(): void {
    // Tactile OP-1 / Braun precision switch click
    const jitter = 0.98 + Math.random() * 0.04;
    this.playTone(1120 * jitter, 0.032, 'sine', 0.055, 0, 760 * jitter);
    this.playFilteredNoise(0.018, 'highpass', 2400, 1800, 1.2, 0.035, 0);
  }

  public playStartChime(): void {
    // Warm Nordic maj9 glass chord
    const notes = [293.66, 440.0, 554.37, 659.25];
    notes.forEach((f, i) => {
      this.playTone(f, 0.28, 'sine', 0.095, i * 0.055);
      this.playTone(f * 2, 0.16, 'triangle', 0.03, i * 0.055);
    });
  }

  public playTossWhoosh(): void {
    const jitter = 0.95 + Math.random() * 0.1;
    this.playFilteredNoise(0.14, 'bandpass', 520 * jitter, 1450 * jitter, 1.8, 0.11, 0);
    this.playTone(320 * jitter, 0.11, 'sine', 0.065, 0, 540 * jitter);
  }

  public playDeliverySuccess(combo: number, expressToss: boolean, bullseye: boolean = false): void {
    const semitoneBoost = Math.min(8, combo - 1);
    const mult = Math.pow(2, semitoneBoost / 12);

    // Soft craft-parcel settle thump
    this.playTone(125, 0.075, 'sine', 0.09, 0.015, 68);
    this.playFilteredNoise(0.05, 'lowpass', 520, 160, 0.9, 0.065, 0.015);

    // Glassy Scandinavian harmonic bell triad
    this.playTone(587.33 * mult, 0.22, 'sine', 0.11, 0.025);
    this.playTone(880.0 * mult, 0.24, 'sine', 0.1, 0.075);
    this.playTone(1108.73 * mult, 0.28, 'sine', 0.095, 0.125);
    if (expressToss) {
      this.playTone(1318.51 * mult, 0.3, 'sine', 0.09, 0.175);
    }
    if (bullseye) {
      this.playTone(1760.0 * mult, 0.34, 'sine', 0.105, 0.22);
      this.playTone(2217.46 * mult, 0.26, 'triangle', 0.045, 0.26);
    }
  }

  public playMusicalHorn(): void {
    // Refined two-tone Scandinavian EV / tram pedestrian courtesy bell
    const notes = [
      { f: 587.33, d: 0.12, t: 0 },
      { f: 880.0, d: 0.2, t: 0.095 },
    ];
    for (const m of notes) {
      this.playTone(m.f, m.d, 'sine', 0.095, m.t);
      this.playTone(m.f * 2, m.d * 0.75, 'triangle', 0.032, m.t);
    }
  }

  public playNearMissWhoosh(): void {
    const jitter = 0.95 + Math.random() * 0.1;
    this.playFilteredNoise(0.16, 'bandpass', 1300 * jitter, 380 * jitter, 1.8, 0.095, 0);
    this.playTone(784 * jitter, 0.12, 'sine', 0.05, 0.02, 1174 * jitter);
  }

  public playJumpLaunch(): void {
    this.playFilteredNoise(0.16, 'bandpass', 360, 1400, 1.5, 0.09, 0);
    this.playTone(240, 0.22, 'sine', 0.095, 0, 587.33);
    this.playTone(480, 0.2, 'triangle', 0.045, 0.035, 880);
  }

  public playMechanicWrench(): void {
    // Precision torque click + warm harmonic confirmation
    this.playTone(1380, 0.04, 'triangle', 0.055, 0, 1680);
    this.playTone(1640, 0.04, 'triangle', 0.055, 0.055, 1960);
    this.playTone(440.0, 0.24, 'sine', 0.095, 0.11);
    this.playTone(659.25, 0.28, 'sine', 0.095, 0.155);
  }

  public playDuckQuack(): void {
    for (const d of [0, 0.13]) {
      this.playTone(410, 0.08, 'triangle', 0.055, d, 305);
      this.playFilteredNoise(0.065, 'bandpass', 920, 620, 2.8, 0.06, d);
    }
  }

  public playHydrantSplash(): void {
    this.playFilteredNoise(0.26, 'bandpass', 850, 2200, 1.3, 0.11, 0);
    this.playTone(660, 0.14, 'sine', 0.05, 0.025, 1120);
  }

  public playSpinReward(): void {
    const notes = [440.0, 554.37, 659.25, 880.0, 1108.73];
    notes.forEach((f, idx) => {
      this.playTone(f, 0.24, 'sine', 0.095, idx * 0.055);
    });
  }

  public playBoost(): void {
    const jitter = 0.96 + Math.random() * 0.08;
    this.playFilteredNoise(0.22, 'bandpass', 320, 1850, 1.6, 0.11, 0);
    this.playTone(220 * jitter, 0.24, 'sine', 0.1, 0, 523.25 * jitter);
    this.playTone(440 * jitter, 0.2, 'triangle', 0.055, 0.03, 783.99 * jitter);
  }

  public playWindupTelegraph(isGate: boolean): void {
    if (isGate) {
      // Nordic canal bridge bell
      this.playTone(987.77, 0.16, 'sine', 0.08, 0);
      this.playTone(783.99, 0.18, 'sine', 0.08, 0.14);
    } else {
      for (const d of [0, 0.09]) {
        this.playTone(1174.66, 0.085, 'sine', 0.07, d);
      }
    }
  }

  public playTrafficHorn(): void {
    const jitter = 0.97 + Math.random() * 0.06;
    for (const d of [0, 0.12]) {
      this.playTone(440 * jitter, 0.085, 'triangle', 0.055, d);
      this.playTone(523.25 * jitter, 0.085, 'sine', 0.055, d);
    }
  }

  public playCurbBump(): void {
    const jitter = 0.94 + Math.random() * 0.12;
    this.playTone(118 * jitter, 0.09, 'sine', 0.095, 0, 56);
    this.playFilteredNoise(0.055, 'lowpass', 340, 110, 1.1, 0.065, 0);
  }

  public playDamageHit(): void {
    this.playCrashImpact('crash', 'vehicle');
  }

  /**
   * Damped architectural model / birch & chassis impact foley (free of cartoon boings)
   */
  public playCrashImpact(
    severity: 'bump' | 'crash',
    kind: 'vehicle' | 'building' | 'prop' | 'gate' | 'rival' | 'ai_vehicle',
  ): void {
    const nowMs = typeof performance !== 'undefined' ? performance.now() : Date.now();
    if (nowMs - this.lastPlayerCrashAtMs < 140) return;
    this.lastPlayerCrashAtMs = nowMs;

    const jitter = 0.95 + Math.random() * 0.1;
    const isHeavy = severity === 'crash';

    // Damped chassis / timber thud
    this.playFilteredNoise(
      isHeavy ? 0.19 : 0.11,
      'lowpass',
      (isHeavy ? 760 : 520) * jitter,
      130,
      1.2,
      isHeavy ? 0.16 : 0.1,
      0,
    );
    this.playTone(
      (isHeavy ? 155 : 128) * jitter,
      isHeavy ? 0.18 : 0.12,
      'sine',
      isHeavy ? 0.14 : 0.095,
      0,
      isHeavy ? 46 : 58,
    );

    // Muted low-fifth warning interval on heavy hull damage
    if (isHeavy) {
      this.playTone(293.66 * jitter, 0.14, 'triangle', 0.065, 0.03);
      this.playTone(220.0 * jitter, 0.18, 'sine', 0.075, 0.09);
    }

    if (kind === 'vehicle' || kind === 'rival') {
      this.playTrafficHorn();
    } else if (kind === 'gate') {
      this.playTone(987.77 * jitter, 0.12, 'sine', 0.06, 0.02);
    }
  }

  public playAiFenderBender(): void {
    const nowMs = typeof performance !== 'undefined' ? performance.now() : Date.now();
    if (nowMs - this.lastAiCrashAtMs < 750) return;
    this.lastAiCrashAtMs = nowMs;

    const jitter = 0.95 + Math.random() * 0.1;
    this.playFilteredNoise(0.09, 'lowpass', 480 * jitter, 150, 1.1, 0.055, 0);
    this.playTone(145 * jitter, 0.09, 'sine', 0.055, 0, 68);
  }

  public playTimerTick(urgent: boolean): void {
    this.playTone(urgent ? 880.0 : 659.25, 0.045, 'sine', urgent ? 0.065 : 0.038, 0);
  }

  public playStageClear(): void {
    this.silenceEngineImmediate();
    const chord = [293.66, 440.0, 554.37, 659.25, 880.0, 1108.73];
    chord.forEach((f, idx) => {
      this.playTone(f, 0.38, 'sine', 0.1, idx * 0.065);
      this.playTone(f * 2, 0.22, 'triangle', 0.03, idx * 0.065 + 0.015);
    });
  }

  public playTicketCitation(): void {
    this.playFilteredNoise(0.04, 'highpass', 1800, 2800, 1.5, 0.08, 0);
    this.playTone(740, 0.1, 'triangle', 0.075, 0.02);
    this.playTone(554.37, 0.14, 'triangle', 0.075, 0.12);
  }

  public playCoffeePickup(): void {
    this.playFilteredNoise(0.12, 'bandpass', 1100, 2200, 1.8, 0.07, 0);
    const notes = [587.33, 739.99, 1108.73];
    notes.forEach((f, i) => {
      this.playTone(f, 0.18, 'sine', 0.09, 0.025 + i * 0.055);
    });
  }

  public playGameOver(): void {
    this.silenceEngineImmediate();
    const notes = [440, 392, 329.63, 293.66];
    notes.forEach((f, idx) => {
      this.playTone(f, 0.3, 'sine', 0.095, idx * 0.11);
    });
  }

  public playCountdownBeep(stage: 3 | 2 | 1 | 0): void {
    if (stage === 0) {
      const goChord = [440.0, 554.37, 659.25, 880.0];
      goChord.forEach((f, idx) => {
        this.playTone(f, 0.3, 'sine', 0.1, idx * 0.02);
        this.playTone(f * 2, 0.18, 'triangle', 0.035, idx * 0.02);
      });
      return;
    }

    const rootFreq = stage === 3 ? 440.0 : stage === 2 ? 493.88 : 554.37;
    this.playTone(rootFreq, 0.14, 'sine', 0.1, 0);
    this.playTone(rootFreq * 2, 0.09, 'triangle', 0.035, 0.008);
  }

  public playCountdownRev(intensity: number = 1): void {
    const nowMs = typeof performance !== 'undefined' ? performance.now() : Date.now();
    if (nowMs - this.lastRevAtMs < 190) return;
    this.lastRevAtMs = nowMs;

    const clamped = Math.max(0.5, Math.min(1.5, intensity));
    const base = 92 * clamped;
    this.playTone(base, 0.15, 'sine', 0.055, 0, base * 1.48);
    this.playTone(base * 2, 0.12, 'triangle', 0.035, 0.01, base * 2.6);
  }

  public playEngineSputter(): void {
    const nowMs = typeof performance !== 'undefined' ? performance.now() : Date.now();
    if (nowMs - this.lastRevAtMs < 260) return;
    this.lastRevAtMs = nowMs;

    this.playFilteredNoise(0.09, 'lowpass', 380, 140, 1.6, 0.075, 0);
    this.playTone(130, 0.09, 'triangle', 0.055, 0, 72);
  }

  public playRocketStart(): void {
    this.playFilteredNoise(0.24, 'bandpass', 380, 2200, 1.6, 0.12, 0);
    this.playTone(220, 0.24, 'sine', 0.085, 0, 659.25);
    const fanfare = [587.33, 739.99, 880.0, 1174.66];
    fanfare.forEach((f, i) => {
      this.playTone(f, 0.22, 'sine', 0.09, 0.025 + i * 0.045);
    });
  }

  public playAmbientCarHorn(isBus: boolean = false, volumeScale: number = 1): void {
    const nowMs = typeof performance !== 'undefined' ? performance.now() : Date.now();
    if (nowMs - this.lastAmbientHornAtMs < 920) return;
    this.lastAmbientHornAtMs = nowMs;

    const vol = Math.max(0.15, Math.min(1, volumeScale));
    const jitter = 0.96 + Math.random() * 0.08;

    if (isBus) {
      for (const d of [0, 0.16]) {
        const dur = d === 0 ? 0.11 : 0.18;
        this.playTone(246.94 * jitter, dur, 'triangle', 0.045 * vol, d);
        this.playTone(329.63 * jitter, dur, 'sine', 0.048 * vol, d);
      }
    } else {
      const pitchPick = Math.random() < 0.5 ? 1.0 : 1.12;
      const f1 = 440 * pitchPick * jitter;
      const f2 = 554.37 * pitchPick * jitter;
      for (const d of [0, 0.1]) {
        this.playTone(f1, 0.07, 'sine', 0.038 * vol, d);
        this.playTone(f2, 0.07, 'triangle', 0.042 * vol, d);
      }
    }
  }

  public playBirdChirp(volumeScale: number = 1): void {
    const nowMs = typeof performance !== 'undefined' ? performance.now() : Date.now();
    if (nowMs - this.lastBirdChirpAtMs < 1350) return;
    this.lastBirdChirpAtMs = nowMs;

    const vol = Math.max(0.2, Math.min(1, volumeScale));
    const base = 1850 + Math.random() * 480;
    const notes = 2;
    for (let i = 0; i < notes; i++) {
      const t = i * 0.085;
      const startF = base * (1 + i * 0.06);
      const endF = startF * (i % 2 === 0 ? 1.18 : 0.88);
      this.playTone(startF, 0.065, 'sine', 0.028 * vol, t, endF);
    }
  }

  public playCoinTossClink(coinIdx: number = 0): void {
    const stepMult = Math.pow(2, (coinIdx % 4) * (2 / 12));
    this.playTone(1318.51 * stepMult, 0.09, 'sine', 0.055, 0);
    this.playTone(1975.53 * stepMult, 0.12, 'sine', 0.04, 0.025);
  }
}

export const pokoAudio = new PokoAudioEngine();
