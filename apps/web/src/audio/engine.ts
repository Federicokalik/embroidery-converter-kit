/**
 * Machine sound design, fully synthesized (zero audio assets):
 * - needle tick: a 30 ms white-noise burst through a bandpass with an
 *   exponential decay, slightly detuned per hit;
 * - machine hum: two detuned triangle oscillators through a lowpass,
 *   gain driven by stitching/scroll activity.
 * The AudioContext is created lazily on a user gesture (autoplay
 * policy) and the master gain is the single mute switch.
 */

const TICK_MIN_INTERVAL_MS = 33;

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private humGain: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private lastTick = 0;
  private on = false;

  private build(): void {
    if (this.ctx !== null) return;
    const ctx = new AudioContext();
    this.ctx = ctx;

    this.master = ctx.createGain();
    this.master.gain.value = 0;
    this.master.connect(ctx.destination);

    // Hum: 55 Hz + a detuned octave, softened by a lowpass.
    const humFilter = ctx.createBiquadFilter();
    humFilter.type = 'lowpass';
    humFilter.frequency.value = 260;
    this.humGain = ctx.createGain();
    this.humGain.gain.value = 0;
    humFilter.connect(this.humGain);
    this.humGain.connect(this.master);
    for (const [freq, level] of [
      [55, 0.5],
      [110.7, 0.3],
    ] as const) {
      const osc = ctx.createOscillator();
      osc.type = 'triangle';
      osc.frequency.value = freq;
      const g = ctx.createGain();
      g.gain.value = level;
      osc.connect(g);
      g.connect(humFilter);
      osc.start();
    }

    // Shared white-noise buffer for the ticks.
    const len = Math.floor(ctx.sampleRate * 0.03);
    this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  }

  get enabled(): boolean {
    return this.on;
  }

  enable(): void {
    this.build();
    const ctx = this.ctx!;
    void ctx.resume();
    this.on = true;
    this.master!.gain.cancelScheduledValues(ctx.currentTime);
    this.master!.gain.linearRampToValueAtTime(1, ctx.currentTime + 0.25);
  }

  disable(): void {
    this.on = false;
    if (this.ctx === null || this.master === null) return;
    this.master.gain.cancelScheduledValues(this.ctx.currentTime);
    this.master.gain.linearRampToValueAtTime(0, this.ctx.currentTime + 0.15);
  }

  /** One needle hit; intensity 0..1 scales volume. Rate-limited. */
  tick(intensity = 1): void {
    if (!this.on || this.ctx === null || this.noise === null) return;
    const now = performance.now();
    if (now - this.lastTick < TICK_MIN_INTERVAL_MS) return;
    this.lastTick = now;

    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const band = ctx.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.value = 1650 + Math.random() * 400;
    band.Q.value = 5;
    const g = ctx.createGain();
    const t0 = ctx.currentTime;
    g.gain.setValueAtTime(0.35 * Math.min(1, intensity), t0);
    g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.05);
    src.connect(band);
    band.connect(g);
    g.connect(this.master!);
    src.start();
    src.stop(t0 + 0.06);
  }

  /** Machine speed, 0..1: drives the hum loudness. */
  setHum(level: number): void {
    if (this.ctx === null || this.humGain === null) return;
    const clamped = Math.max(0, Math.min(1, level));
    this.humGain.gain.linearRampToValueAtTime(
      clamped * 0.14,
      this.ctx.currentTime + 0.12,
    );
  }
}
