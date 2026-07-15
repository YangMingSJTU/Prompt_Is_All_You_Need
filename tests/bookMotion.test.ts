import { describe, expect, it } from 'vitest';
import {
  BOOK_CONTENT_CYCLE_MS,
  BOOK_OPENING_DURATION_MS,
  getBookSettleProgress,
  getBookSpreadIndex,
  getIconBookRevealProgress,
  getIconBookTransitionPose,
  getIconMarkOpacity,
  getPageTurnProgress
} from '../desktop/renderer/bookMotion';

describe('recommendation book motion', () => {
  it('fades the icon mark while the curved book reveals with a small overshoot', () => {
    expect(getIconMarkOpacity(0)).toBe(1);
    expect(getIconBookRevealProgress(0)).toBe(0);
    expect(getIconMarkOpacity(1400)).toBe(0);
    expect(getIconBookRevealProgress(1400)).toBeGreaterThan(1);
    expect(getIconBookRevealProgress(BOOK_OPENING_DURATION_MS)).toBe(1);
    expect(getBookSettleProgress(BOOK_OPENING_DURATION_MS)).toBe(1);
  });

  it('keeps page turns inside the end of the content cycle', () => {
    expect(getPageTurnProgress(BOOK_CONTENT_CYCLE_MS * 0.5)).toBe(0);
    expect(getPageTurnProgress(BOOK_CONTENT_CYCLE_MS * 0.8)).toBeGreaterThan(0);
    expect(getPageTurnProgress(BOOK_CONTENT_CYCLE_MS * 0.97)).toBe(1);
    expect(getPageTurnProgress(BOOK_CONTENT_CYCLE_MS)).toBe(0);
  });

  it('adds a small shared lift while the shader sweeps to the next spread', () => {
    const start = getIconBookTransitionPose(0);
    const middle = getIconBookTransitionPose(0.5);
    const finish = getIconBookTransitionPose(1);

    expect(start).toMatchObject({
      glow: 0,
      lift: 0,
      scale: 1
    });
    expect(middle.glow).toBe(1);
    expect(middle.lift).toBeGreaterThan(0);
    expect(middle.scale).toBeLessThan(1);
    expect(finish.scale).toBe(1);
    expect(finish.glow).toBeCloseTo(0, 8);
  });

  it('advances the prepared artwork only after a complete page cycle', () => {
    expect(getBookSpreadIndex(0, 8)).toBe(0);
    expect(getBookSpreadIndex(BOOK_CONTENT_CYCLE_MS - 1, 8)).toBe(0);
    expect(getBookSpreadIndex(BOOK_CONTENT_CYCLE_MS, 8)).toBe(1);
    expect(getBookSpreadIndex(BOOK_CONTENT_CYCLE_MS * 8, 8)).toBe(0);
  });
});
