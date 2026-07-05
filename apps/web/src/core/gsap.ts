/**
 * Single GSAP entry point: plugin registration and motion gates.
 * Every animation module imports gsap from here.
 *
 * ScrollSmoother is intentionally NOT used: long pins over a fixed WebGL
 * canvas are fragile under transform-based smoothing. Scroll inertia for
 * the 3D layer comes from the stage's ticker lerp instead.
 */
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { ScrollToPlugin } from 'gsap/ScrollToPlugin';
import { DrawSVGPlugin } from 'gsap/DrawSVGPlugin';
import { SplitText } from 'gsap/SplitText';

gsap.registerPlugin(ScrollTrigger, ScrollToPlugin, DrawSVGPlugin, SplitText);
gsap.defaults({ ease: 'power2.out', duration: 0.6 });
ScrollTrigger.config({ ignoreMobileResize: true });

/** Static gate: with reduced motion the page is fully static. */
export const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Pins and the WebGL stage are desktop-only; mobile gets simple reveals. */
export function isDesktop(): boolean {
  return window.matchMedia('(min-width: 1024px)').matches;
}

/** Nav/CTA anchors: smooth scroll to a section. */
export function scrollToSection(selector: string): void {
  const target = document.querySelector(selector);
  if (target === null) return;
  if (reduceMotion) {
    target.scrollIntoView();
    return;
  }
  gsap.to(window, {
    scrollTo: { y: target, offsetY: 80 },
    duration: 0.9,
    ease: 'power2.inOut',
  });
}

/** Layout changed (language switch, fonts): recompute every trigger. */
export function refreshScroll(): void {
  requestAnimationFrame(() => ScrollTrigger.refresh());
}

export { gsap, ScrollTrigger, SplitText };
