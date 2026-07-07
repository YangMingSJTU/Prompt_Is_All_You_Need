import { describe, expect, it } from 'vitest';
import { calculateFloatingPanelPosition } from '../desktop/shared/floatingPlacement';

const workArea = { x: 100, y: 50, width: 1000, height: 700 };
const panelBounds = { width: 560, height: 420 };

describe('floating panel placement', () => {
  it('centers the panel in the current display work area', () => {
    expect(
      calculateFloatingPanelPosition({
        placement: 'center',
        cursorPoint: { x: 600, y: 400 },
        workArea,
        panelBounds
      })
    ).toEqual({ x: 320, y: 190 });
  });

  it('positions the panel near the cursor with a small offset', () => {
    expect(
      calculateFloatingPanelPosition({
        placement: 'mouse',
        cursorPoint: { x: 300, y: 180 },
        workArea,
        panelBounds
      })
    ).toEqual({ x: 316, y: 196 });
  });

  it('clamps mouse placement inside the current display work area', () => {
    expect(
      calculateFloatingPanelPosition({
        placement: 'mouse',
        cursorPoint: { x: 1080, y: 720 },
        workArea,
        panelBounds
      })
    ).toEqual({ x: 540, y: 330 });
  });

  it('keeps mouse placement inside the top-left work area bounds', () => {
    expect(
      calculateFloatingPanelPosition({
        placement: 'mouse',
        cursorPoint: { x: 80, y: 30 },
        workArea,
        panelBounds
      })
    ).toEqual({ x: 100, y: 50 });
  });
});
