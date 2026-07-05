/**
 * Audio wiring: nav toggle (muted by default, stitched strike-through
 * when off) + stitch events -> needle ticks, activity -> machine hum.
 * Preference persists; a stored "on" still waits for the first user
 * gesture before creating the AudioContext (autoplay policy).
 */
import { gsap, reduceMotion } from '../core/gsap';
import { onLangChange, t } from '../i18n/i18n';
import type { StitchStage } from '../stage/types';
import { AudioEngine } from './engine';

const STORAGE_KEY = 'restitch-audio';

export interface AudioWiring {
  /** (Re)subscribe to a stage's stitch events (also after downgrade). */
  attach(stage: StitchStage): void;
}

export function initAudioToggle(): AudioWiring {
  const btn = document.getElementById('audio-toggle') as HTMLButtonElement | null;
  const engine = new AudioEngine();
  let on = false;
  let activity = 0;
  const lastSeg = new Map<string, number>();

  if (btn === null) return { attach: () => undefined };
  btn.hidden = false;

  const sync = (): void => {
    btn.setAttribute('aria-pressed', String(on));
    btn.setAttribute('aria-label', t(on ? 'nav.audioOff' : 'nav.audioOn'));
  };

  btn.addEventListener('click', () => {
    on = !on;
    localStorage.setItem(STORAGE_KEY, on ? 'on' : 'off');
    if (on) engine.enable();
    else engine.disable();
    sync();
  });

  // Stored preference: arm on the first gesture, never before.
  // Reduced motion keeps audio off by default (still user-enableable).
  if (localStorage.getItem(STORAGE_KEY) === 'on' && !reduceMotion) {
    const arm = (): void => {
      on = true;
      engine.enable();
      sync();
    };
    document.addEventListener('pointerdown', arm, { once: true });
  }

  sync();
  onLangChange(sync);

  // Hum follows overall stitching activity, decaying between bursts.
  let lastY = window.scrollY;
  gsap.ticker.add(() => {
    const dy = Math.abs(window.scrollY - lastY);
    lastY = window.scrollY;
    activity = Math.min(1, activity * 0.92 + dy / 2400);
    if (on) engine.setHum(activity);
  });

  return {
    attach(stage: StitchStage): void {
      lastSeg.clear();
      stage.onStitch((entity, seg) => {
        const prev = lastSeg.get(entity) ?? 0;
        lastSeg.set(entity, seg);
        const delta = seg - prev;
        if (delta <= 0) return;
        activity = Math.min(1, activity + delta / 400);
        engine.tick(Math.min(1, delta / 10 + 0.25));
      });
    },
  };
}
