import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('click feedback tooltip UI', () => {
  it('does not render click success feedback in the global topbar', () => {
    const app = readFileSync('desktop/renderer/App.tsx', 'utf8');
    const styles = readFileSync('desktop/renderer/styles.css', 'utf8');

    expect(app).not.toContain('status-pill');
    expect(app).not.toContain('onMessage={setMessage}');
    expect(app).not.toContain('useState(\'\')');
    expect(styles).not.toContain('.status-pill');
  });

  it('uses a reusable tooltip target for click-triggered feedback', () => {
    const tooltip = readFileSync('desktop/renderer/components/FeedbackTooltip.tsx', 'utf8');
    const styles = readFileSync('desktop/renderer/styles.css', 'utf8');
    const library = readFileSync('desktop/renderer/components/LibraryView.tsx', 'utf8');
    const panel = readFileSync('desktop/renderer/components/SpellPanel.tsx', 'utf8');
    const skills = readFileSync('desktop/renderer/components/SkillLibraryView.tsx', 'utf8');
    const scanner = readFileSync('desktop/renderer/components/ScannerView.tsx', 'utf8');
    const settings = readFileSync('desktop/renderer/components/SettingsView.tsx', 'utf8');
    const floating = readFileSync('desktop/renderer/components/FloatingPanel.tsx', 'utf8');

    expect(tooltip).toContain('useFeedbackTooltip');
    expect(tooltip).toContain('FeedbackTooltip');
    expect(tooltip).toContain('role="status"');
    expect(styles).toContain('.feedback-target');
    expect(styles).toContain('.feedback-tooltip');

    for (const component of [library, panel, skills, scanner, settings, floating]) {
      expect(component).toContain('FeedbackTooltip');
      expect(component).not.toContain('onMessage(');
    }
  });

  it('records the tooltip feedback rule in AGENTS.md', () => {
    const agents = readFileSync('AGENTS.md', 'utf8');

    expect(agents).toContain('Tooltip');
    expect(agents).toContain('global status');
  });
});
