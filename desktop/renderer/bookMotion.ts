export const BOOK_OPENING_DURATION_MS = 3200;
export const BOOK_PAGE_COUNT = 6;
export const BOOK_CONTENT_CYCLE_MS = 7800;

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

export function smoothProgress(startMs: number, endMs: number, elapsedMs: number): number {
  const progress = clamp01((elapsedMs - startMs) / (endMs - startMs));
  return progress * progress * (3 - 2 * progress);
}

export function getCoverOpenProgress(elapsedMs: number): number {
  return smoothProgress(420, 2380, elapsedMs);
}

export function getPageOpenProgress(elapsedMs: number, pageIndex: number): number {
  const index = Math.min(BOOK_PAGE_COUNT - 1, Math.max(0, pageIndex));
  return smoothProgress(980 + index * 115, 2520 + index * 92, elapsedMs);
}

export function getBookSettleProgress(elapsedMs: number): number {
  return smoothProgress(0, BOOK_OPENING_DURATION_MS, elapsedMs);
}

export function getPageTurnProgress(contentElapsedMs: number): number {
  const cycleProgress =
    ((contentElapsedMs % BOOK_CONTENT_CYCLE_MS) + BOOK_CONTENT_CYCLE_MS) %
    BOOK_CONTENT_CYCLE_MS;
  return smoothProgress(
    BOOK_CONTENT_CYCLE_MS * 0.69,
    BOOK_CONTENT_CYCLE_MS * 0.92,
    cycleProgress
  );
}

export function getSpellFadeOpacity(
  contentElapsedMs: number,
  fadeStartFraction: number,
  fadeDuration = 0.12
): number {
  const cycle =
    (((contentElapsedMs % BOOK_CONTENT_CYCLE_MS) + BOOK_CONTENT_CYCLE_MS) %
      BOOK_CONTENT_CYCLE_MS) /
    BOOK_CONTENT_CYCLE_MS;
  return 1 - smoothProgress(
    fadeStartFraction,
    fadeStartFraction + fadeDuration,
    cycle
  );
}
