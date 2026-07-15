import { describe, expect, it } from 'vitest';
import {
  BOOK_CONTENT_CYCLE_MS,
  BOOK_OPENING_DURATION_MS,
  BOOK_PAGE_COUNT,
  getBookSettleProgress,
  getBookSpreadIndex,
  getCoverOpenProgress,
  getPageOpenProgress,
  getPageTurnProgress,
  getPageTurnVertex
} from '../desktop/renderer/bookMotion';

describe('recommendation book motion', () => {
  it('opens the cover before the final page settles', () => {
    expect(getCoverOpenProgress(0)).toBe(0);
    expect(getCoverOpenProgress(1400)).toBeGreaterThan(0.4);
    expect(getCoverOpenProgress(BOOK_OPENING_DURATION_MS)).toBe(1);
    expect(getPageOpenProgress(1400, 0)).toBeGreaterThan(
      getPageOpenProgress(1400, BOOK_PAGE_COUNT - 1)
    );
    expect(getPageOpenProgress(BOOK_OPENING_DURATION_MS, BOOK_PAGE_COUNT - 1)).toBe(1);
    expect(getBookSettleProgress(BOOK_OPENING_DURATION_MS)).toBe(1);
  });

  it('keeps page turns inside the end of the content cycle', () => {
    expect(getPageTurnProgress(BOOK_CONTENT_CYCLE_MS * 0.5)).toBe(0);
    expect(getPageTurnProgress(BOOK_CONTENT_CYCLE_MS * 0.8)).toBeGreaterThan(0);
    expect(getPageTurnProgress(BOOK_CONTENT_CYCLE_MS * 0.97)).toBe(1);
    expect(getPageTurnProgress(BOOK_CONTENT_CYCLE_MS)).toBe(0);
  });

  it('curls the page around a leading edge and settles it flat', () => {
    const start = getPageTurnVertex(1, 0.5, 0);
    const middle = getPageTurnVertex(0.5, 0.5, 0.5);
    const finish = getPageTurnVertex(1, 0.5, 1);

    expect(start).toEqual({ xRatio: 1, yOffsetRatio: 0, zRatio: 0 });
    expect(middle.zRatio).toBeGreaterThan(0.5);
    expect(finish.xRatio).toBeCloseTo(-1, 8);
    expect(finish.yOffsetRatio).toBeCloseTo(0, 8);
    expect(finish.zRatio).toBeCloseTo(0, 8);
  });

  it('advances the prepared artwork only after a complete page cycle', () => {
    expect(getBookSpreadIndex(0, 8)).toBe(0);
    expect(getBookSpreadIndex(BOOK_CONTENT_CYCLE_MS - 1, 8)).toBe(0);
    expect(getBookSpreadIndex(BOOK_CONTENT_CYCLE_MS, 8)).toBe(1);
    expect(getBookSpreadIndex(BOOK_CONTENT_CYCLE_MS * 8, 8)).toBe(0);
  });
});
