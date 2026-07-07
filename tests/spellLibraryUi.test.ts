import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('spell library UI structure', () => {
  it('uses a scrollable list and editor layout instead of full raw text cards', () => {
    const component = readFileSync('desktop/renderer/components/LibraryView.tsx', 'utf8');
    const styles = readFileSync('desktop/renderer/styles.css', 'utf8');

    expect(component).toContain('spell-library-grid');
    expect(component).toContain('spell-list-pane');
    expect(component).toContain('spell-editor-pane');
    expect(component).toContain('spell-list-row');
    expect(component).toContain('spell-preview-line');
    expect(component).not.toContain('className="spell-card"');

    expect(styles).toContain('.spell-list');
    expect(styles.match(/\.spell-list\s*\{[^}]+overflow: auto;[^}]+\}/s)?.[0]).toBeTruthy();
    expect(styles.match(/\.spell-preview-line\s*\{[^}]+text-overflow: ellipsis;[^}]+\}/s)?.[0]).toBeTruthy();
  });
});
