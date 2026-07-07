import { existsSync } from 'node:fs';
import { join, normalize } from 'node:path';
import { describe, expect, it } from 'vitest';
import { getAppIconPath } from '../desktop/main/services/appAssets';

describe('app assets', () => {
  it('resolves the runtime app icon from the assets directory', () => {
    const iconPath = getAppIconPath(process.cwd());

    expect(normalize(iconPath)).toBe(normalize(join(process.cwd(), 'assets', 'icons', 'app-icon.png')));
    expect(iconPath).not.toContain('docs');
    expect(existsSync(iconPath)).toBe(true);
  });
});
