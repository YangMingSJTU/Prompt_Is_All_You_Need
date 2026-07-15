import { describe, expect, it } from 'vitest';
import {
  BOOK_CONTENT_CYCLE_MS,
  BOOK_OPENING_DURATION_MS,
  BOOK_PAGE_COUNT,
  getBookSettleProgress,
  getCoverOpenProgress,
  getPageOpenProgress,
  getPageTurnProgress,
  getSpellFadeOpacity
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
    expect(getPageTurnProgress(BOOK_CONTENT_CYCLE_MS * 0.94)).toBe(1);
    expect(getPageTurnProgress(BOOK_CONTENT_CYCLE_MS)).toBe(0);
  });

  it('starts each page full and fades every inscription before the page turn', () => {
    const full = getSpellFadeOpacity(0, 0.2);
    const fading = getSpellFadeOpacity(BOOK_CONTENT_CYCLE_MS * 0.26, 0.2);
    const gone = getSpellFadeOpacity(BOOK_CONTENT_CYCLE_MS * 0.69, 0.55);

    expect(full).toBe(1);
    expect(fading).toBeGreaterThan(0);
    expect(fading).toBeLessThan(1);
    expect(gone).toBe(0);
    expect(getSpellFadeOpacity(BOOK_CONTENT_CYCLE_MS, 0.2)).toBe(1);
  });
});
