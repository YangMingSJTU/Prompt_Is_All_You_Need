export interface SplitPaneConstraints {
  containerWidth: number;
  dividerWidth: number;
  minStartWidth: number;
  minEndWidth: number;
}

export function calculateSplitRatio(
  pointerX: number,
  containerLeft: number,
  constraints: SplitPaneConstraints
): number {
  const availableWidth = Math.max(constraints.containerWidth - constraints.dividerWidth, 1);
  const desiredStartWidth = pointerX - containerLeft - constraints.dividerWidth / 2;
  return clampSplitRatio((desiredStartWidth / availableWidth) * 100, constraints);
}

export function clampSplitRatio(
  ratio: number,
  constraints: SplitPaneConstraints
): number {
  const availableWidth = Math.max(constraints.containerWidth - constraints.dividerWidth, 1);
  if (availableWidth < constraints.minStartWidth + constraints.minEndWidth) {
    return 50;
  }

  const minRatio = (constraints.minStartWidth / availableWidth) * 100;
  const maxRatio = ((availableWidth - constraints.minEndWidth) / availableWidth) * 100;
  return Math.min(Math.max(ratio, minRatio), maxRatio);
}
