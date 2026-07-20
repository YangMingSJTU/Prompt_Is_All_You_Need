export const BOOK_OPENING_DURATION_MS = 3200;
export const BOOK_CONTENT_CYCLE_MS = 6500;

export interface IconBookTransitionPose {
  glow: number;
  lift: number;
  scale: number;
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function smootherUnitProgress(value: number): number {
  const progress = clamp01(value);
  if (progress <= Number.EPSILON) {
    return 0;
  }
  if (progress >= 1 - Number.EPSILON) {
    return 1;
  }
  return progress * progress * progress * (progress * (progress * 6 - 15) + 10);
}

export function smoothProgress(startMs: number, endMs: number, elapsedMs: number): number {
  const progress = clamp01((elapsedMs - startMs) / (endMs - startMs));
  return progress * progress * (3 - 2 * progress);
}

function backOutProgress(value: number): number {
  const progress = clamp01(value);
  const overshoot = 1.35;
  const shifted = progress - 1;
  return 1 + (overshoot + 1) * shifted ** 3 + overshoot * shifted ** 2;
}

export function getIconBookRevealProgress(elapsedMs: number): number {
  return backOutProgress((elapsedMs - 420) / (2380 - 420));
}

export function getIconMarkOpacity(elapsedMs: number): number {
  return 1 - smoothProgress(360, 1220, elapsedMs);
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

export function getIconBookTransitionPose(
  turnProgress: number
): IconBookTransitionPose {
  const progress = clamp01(turnProgress);
  const glow = Math.sin(Math.PI * progress);
  return {
    glow,
    lift: glow * 0.018,
    scale: 1 - glow * 0.025
  };
}
