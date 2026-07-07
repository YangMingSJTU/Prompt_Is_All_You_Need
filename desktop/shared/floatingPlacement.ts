import type { QuickPanelPlacement } from './settings';

export interface Point {
  x: number;
  y: number;
}

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Size {
  width: number;
  height: number;
}

export interface FloatingPanelPositionInput {
  placement: QuickPanelPlacement;
  cursorPoint: Point;
  workArea: Rect;
  panelBounds: Size;
}

const MOUSE_OFFSET = 16;

export function calculateFloatingPanelPosition({
  placement,
  cursorPoint,
  workArea,
  panelBounds
}: FloatingPanelPositionInput): Point {
  if (placement === 'center') {
    return {
      x: Math.round(workArea.x + (workArea.width - panelBounds.width) / 2),
      y: Math.round(workArea.y + (workArea.height - panelBounds.height) / 2)
    };
  }

  return {
    x: clamp(cursorPoint.x + MOUSE_OFFSET, workArea.x, workArea.x + workArea.width - panelBounds.width),
    y: clamp(cursorPoint.y + MOUSE_OFFSET, workArea.y, workArea.y + workArea.height - panelBounds.height)
  };
}

function clamp(value: number, min: number, max: number): number {
  if (max < min) {
    return min;
  }
  return Math.min(Math.max(Math.round(value), min), max);
}
