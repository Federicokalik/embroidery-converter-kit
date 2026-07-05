/**
 * Weighted preloader task runner. Progress is honest: it only advances
 * when a real task settles. A failed task still counts as done (the page
 * must never block on the spectacle; failures downgrade the experience
 * elsewhere, e.g. WebGL -> 2D canvas).
 */

export interface LoadTask {
  weight: number;
  exec: () => Promise<unknown>;
}

export async function runLoader(
  tasks: LoadTask[],
  onProgress: (p: number) => void,
): Promise<void> {
  const total = tasks.reduce((n, t) => n + t.weight, 0);
  let done = 0;
  onProgress(0);
  await Promise.all(
    tasks.map(async (task) => {
      try {
        await task.exec();
      } catch (e) {
        console.warn('preload task failed (continuing)', e);
      }
      done += task.weight;
      onProgress(total > 0 ? done / total : 1);
    }),
  );
  onProgress(1);
}

/** Preload the display faces the first paint depends on. */
export function loadFonts(): Promise<unknown> {
  const faces = [
    '500 1em "Space Grotesk"',
    '600 1em "Space Grotesk"',
    '400 1em "Plus Jakarta Sans"',
    '700 1em "Plus Jakarta Sans"',
    '400 1em "JetBrains Mono"',
    '600 1em "JetBrains Mono"',
  ];
  return Promise.allSettled(faces.map((f) => document.fonts.load(f)));
}
