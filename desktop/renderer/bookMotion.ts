export const BOOK_OPENING_DURATION_MS = 3200;
export const BOOK_PAGE_COUNT = 6;
export const BOOK_CONTENT_CYCLE_MS = 6500;

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function smootherUnitProgress(value: number): number {
  const progress = clamp01(value);
  return progress * progress * progress * (progress * (progress * 6 - 15) + 10);
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
  return smootherUnitProgress(
    (cycleProgress - BOOK_CONTENT_CYCLE_MS * 0.68) /
      (BOOK_CONTENT_CYCLE_MS * (0.96 - 0.68))
  );
}

export function getBookSpreadIndex(contentElapsedMs: number, spreadCount: number): number {
  const safeSpreadCount = Math.max(1, Math.floor(spreadCount));
  const cycleIndex = Math.floor(Math.max(0, contentElapsedMs) / BOOK_CONTENT_CYCLE_MS);
  return cycleIndex % safeSpreadCount;
}

export function getPageTurnVertex(
  normalizedX: number,
  normalizedY: number,
  turnProgress: number
): { xRatio: number; yOffsetRatio: number; zRatio: number } {
  const x = clamp01(normalizedX);
  const y = clamp01(normalizedY);
  const progress = clamp01(turnProgress);
  const columnDelay = 0.12 * (1 - x);
  const delayedProgress = clamp01((progress - columnDelay) / (1 - columnDelay));
  const columnProgress = 1 - Math.pow(1 - delayedProgress, 1.18);
  const angle = Math.PI * columnProgress;
  const lift = Math.sin(Math.PI * progress);
  const pageCenterBias = 1 - Math.abs(y * 2 - 1);
  const curl = Math.sin(Math.PI * x) * lift * (0.09 + pageCenterBias * 0.045);
  const edgeRipple = Math.sin(y * Math.PI * 2 + progress * Math.PI) * x * lift * 0.006;

  return {
    xRatio: x * Math.cos(angle),
    yOffsetRatio: Math.sin((y - 0.5) * Math.PI) * Math.sin(Math.PI * x) * lift * 0.012,
    zRatio: x * Math.sin(angle) + curl + edgeRipple
  };
}
