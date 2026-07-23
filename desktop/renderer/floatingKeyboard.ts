export type FloatingSelectionDirection = 'previous' | 'next';

export function getNextFloatingSelectionIndex(
  currentIndex: number,
  resultCount: number,
  direction: FloatingSelectionDirection
): number {
  if (resultCount <= 0) {
    return -1;
  }
  const boundedCurrent = Math.min(Math.max(currentIndex, 0), resultCount - 1);
  return direction === 'next'
    ? Math.min(boundedCurrent + 1, resultCount - 1)
    : Math.max(boundedCurrent - 1, 0);
}
