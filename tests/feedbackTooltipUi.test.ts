import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('click feedback toast UI', () => {
  it('does not render click success feedback in the global topbar', () => {
    const app = readFileSync('desktop/renderer/App.tsx', 'utf8');
    const styles = readFileSync('desktop/renderer/styles.css', 'utf8');

    expect(app).not.toContain('status-pill');
    expect(app).not.toContain('onMessage={setMessage}');
    expect(app).not.toContain('useState(\'\')');
    expect(styles).not.toContain('.status-pill');
  });

  it('uses an app-level toast for click-triggered feedback', () => {
    const toast = readFileSync('desktop/renderer/components/FeedbackToast.tsx', 'utf8');
    const styles = readFileSync('desktop/renderer/styles.css', 'utf8');
    const app = readFileSync('desktop/renderer/App.tsx', 'utf8');
    const library = readFileSync('desktop/renderer/components/LibraryView.tsx', 'utf8');
    const panel = readFileSync('desktop/renderer/components/SpellPanel.tsx', 'utf8');
    const skills = readFileSync('desktop/renderer/components/SkillLibraryView.tsx', 'utf8');
    const settings = readFileSync('desktop/renderer/components/SettingsView.tsx', 'utf8');
    const floating = readFileSync('desktop/renderer/components/FloatingPanel.tsx', 'utf8');

    expect(toast).toContain('FeedbackToastProvider');
    expect(toast).toContain('useFeedbackToast');
    expect(toast).toContain('FeedbackToastViewport');
    expect(toast).toContain('aria-live="polite"');
    expect(app).toContain('FeedbackToastProvider');
    expect(styles.match(/\.feedback-toast-viewport\s*\{[^}]+position: fixed;[^}]+top: 16px;[^}]+left: 50%;[^}]+transform: translateX\(-50%\);[^}]+\}/s)?.[0]).toBeTruthy();
    expect(styles).not.toContain('.feedback-target');
    expect(styles).not.toContain('.feedback-tooltip');

    for (const component of [library, panel, skills, settings, floating]) {
      expect(component).toContain('useFeedbackToast');
      expect(component).toContain('showToast');
      expect(component).not.toContain('FeedbackTarget');
      expect(component).not.toContain('onMessage(');
    }
  });

  it('records the toast feedback rule in AGENTS.md', () => {
    const agents = readFileSync('AGENTS.md', 'utf8');

    expect(agents).toContain('Toast');
    expect(agents).toContain('Tooltip');
    expect(agents).toContain('click-triggered result feedback');
    expect(agents).not.toContain('use a short Tooltip anchored to the triggering control');
  });
});
