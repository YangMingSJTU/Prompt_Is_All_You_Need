import { describe, expect, it } from 'vitest';
import {
  QUICK_PANEL_MIN_DETAIL_WIDTH,
  QUICK_PANEL_MIN_LIST_WIDTH,
  QUICK_PANEL_SPLITTER_WIDTH
} from '../desktop/shared/layout';
import { calculateSplitRatio, clampSplitRatio } from '../desktop/renderer/splitPane';

const constraints = {
  containerWidth: 1200,
  dividerWidth: QUICK_PANEL_SPLITTER_WIDTH,
  minStartWidth: QUICK_PANEL_MIN_LIST_WIDTH,
  minEndWidth: QUICK_PANEL_MIN_DETAIL_WIDTH
};

describe('split pane sizing', () => {
  it('clamps pointer resizing to both pane minimum widths', () => {
    expect(calculateSplitRatio(-100, 0, constraints)).toBeCloseTo((480 / 1192) * 100);
    expect(calculateSplitRatio(2000, 0, constraints)).toBeCloseTo((832 / 1192) * 100);
  });

  it('preserves an in-range pointer position', () => {
    expect(calculateSplitRatio(600, 0, constraints)).toBeCloseTo((596 / 1192) * 100);
  });

  it('uses an even split when the container cannot satisfy both minimums', () => {
    expect(
      clampSplitRatio(80, {
        ...constraints,
        containerWidth: 750
      })
    ).toBe(50);
  });
});
