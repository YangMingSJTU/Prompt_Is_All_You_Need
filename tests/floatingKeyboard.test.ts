import { describe, expect, it } from 'vitest';
import { getNextFloatingSelectionIndex } from '../desktop/renderer/floatingKeyboard';

describe('floating panel keyboard selection', () => {
  it('stops at the first and last result without wrapping', () => {
    expect(getNextFloatingSelectionIndex(0, 3, 'previous')).toBe(0);
    expect(getNextFloatingSelectionIndex(0, 3, 'next')).toBe(1);
    expect(getNextFloatingSelectionIndex(2, 3, 'next')).toBe(2);
    expect(getNextFloatingSelectionIndex(2, 3, 'previous')).toBe(1);
  });

  it('returns no selection for an empty result list and bounds stale indices', () => {
    expect(getNextFloatingSelectionIndex(0, 0, 'next')).toBe(-1);
    expect(getNextFloatingSelectionIndex(99, 3, 'next')).toBe(2);
    expect(getNextFloatingSelectionIndex(-5, 3, 'previous')).toBe(0);
  });
});
