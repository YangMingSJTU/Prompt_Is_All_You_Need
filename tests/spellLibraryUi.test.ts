import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('spell library UI structure', () => {
  it('keeps the quick panel focused on spell names with traits and a new action', () => {
    const component = readFileSync('desktop/renderer/components/SpellPanel.tsx', 'utf8');
    const app = readFileSync('desktop/renderer/App.tsx', 'utf8');
    const library = readFileSync('desktop/renderer/components/LibraryView.tsx', 'utf8');

    expect(component).toContain('onCreateSpell');
    expect(component).toContain("t('spell.new')");
    expect(component).toContain('selectedTags');
    expect(component).toContain('allTags');
    expect(component).toContain("t('spell.allTags')");
    expect(component).toContain('SpellSortMenu');
    expect(component).toContain('sortSpells');
    expect(component).toContain('variant="button"');
    expect(component).toContain('quick-panel-controls');
    expect(component).not.toContain('toolbar-actions');
    expect(component).toContain('deriveSpellName');
    expect(component).toContain('spell.body.toLowerCase().includes(normalizedQuery)');
    expect(component).toContain('spell.tags.some');
    expect(component).not.toContain('count-pill');
    expect(component).not.toContain("t('metric.spells')");
    expect(component).not.toContain('spell-result-text');

    expect(app).toContain('libraryCreateRequestId');
    expect(app).toContain('openNewSpellDraft');
    expect(app).toContain('onCreateSpell={openNewSpellDraft}');
    expect(app).toContain('createRequestId={libraryCreateRequestId}');

    expect(library).toContain('createRequestId');
    expect(library).toContain('startNewSpell();');
    expect(library).toContain('[createRequestId]');
  });

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

  it('uses search trait filters name editing and delete confirmation without redundant headings', () => {
    const component = readFileSync('desktop/renderer/components/LibraryView.tsx', 'utf8');
    const styles = readFileSync('desktop/renderer/styles.css', 'utf8');

    expect(component).toContain('spell-library-toolbar');
    expect(component).toContain('spell-filter-search');
    expect(component).toContain('SpellSortMenu');
    expect(component).toContain('sortSpells');
    expect(component).toContain('variant="button"');
    expect(component).toContain('tag-filter-row');
    expect(component).toContain('selectedTags');
    expect(component).toContain('tag-editor');
    expect(component).toContain('tag-add-button');
    expect(component).toContain('deleteSpell');
    expect(component).toContain('delete-confirm-popover');
    expect(component).toContain('spell.name');
    expect(component).not.toContain('spell.alias');
    expect(component).not.toContain('<h3>{t(\'library.title\')}</h3>');
    expect(component).not.toContain('{spells.length} {t(\'metric.spells\')}');
    expect(component).not.toContain('<h3>{getSpellTitle(selectedSpell, t)}</h3>');

    expect(styles).toContain('.spell-library-toolbar');
    expect(styles).toContain('.tag-editor');
    expect(styles).toContain('.delete-confirm-popover');
  });

  it('offers a compact plus new spell action and creates through a draft editor', () => {
    const component = readFileSync('desktop/renderer/components/LibraryView.tsx', 'utf8');
    const styles = readFileSync('desktop/renderer/styles.css', 'utf8');

    expect(component).toContain('startNewSpell');
    expect(component).toContain('createSpell');
    expect(component).toContain("t('spell.new')");
    expect(component).toContain("t('spell.create')");
    expect(component).toContain('isCreating');
    expect(component).toContain('aria-label={t(\'spell.new\')}');
    expect(component).toContain('setSelectedTags([])');
    expect(component).toContain('setQuery(\'\')');

    expect(styles).toContain('.spell-toolbar-row');
    expect(styles).toContain('.new-spell-button');
    expect(styles.match(/\.new-spell-button\s*\{[^}]+height: 34px;[^}]+\}/s)?.[0]).toBeTruthy();
  });

  it('keeps the spell library panes from touching the window bottom', () => {
    const styles = readFileSync('desktop/renderer/styles.css', 'utf8');
    const libraryGrid = styles.match(/\.spell-library-grid\s*\{[^}]+\}/s)?.[0] ?? '';
    const listPane = styles.match(/\.spell-list-pane\s*\{[^}]+\}/s)?.[0] ?? '';
    const editorPane = styles.match(/\.spell-editor-pane\s*\{\s*overflow: hidden;[^}]+\}/s)?.[0] ?? '';
    const spellList = styles.match(/\.spell-list\s*\{[^}]+\}/s)?.[0] ?? '';

    expect(libraryGrid).toContain('height: 100%;');
    expect(libraryGrid).not.toContain('calc(100vh - 53px)');
    expect(listPane).toContain('padding: 16px 14px 18px;');
    expect(editorPane).toContain('padding: 16px 18px 18px;');
    expect(spellList).toContain('flex: 1 1 auto;');
    expect(spellList).toContain('min-height: 0;');
    expect(spellList).toContain('overflow: auto;');
  });

  it('keeps quick panel controls aligned without a visible trait scrollbar', () => {
    const styles = readFileSync('desktop/renderer/styles.css', 'utf8');
    const controls = styles.match(/\.quick-panel-controls\s*\{[^}]+\}/s)?.[0] ?? '';
    const traits = styles.match(/\.quick-panel-traits\s*\{[^}]+\}/s)?.[0] ?? '';
    const webkitScrollbar = styles.match(/\.quick-panel-traits::-webkit-scrollbar\s*\{[^}]+\}/s)?.[0] ?? '';

    expect(controls).toContain('display: grid;');
    expect(controls).toContain('grid-template-columns: minmax(0, 1fr) auto auto;');
    expect(controls).toContain('align-items: center;');
    expect(traits).toContain('scrollbar-width: none;');
    expect(traits).toContain('padding-bottom: 0;');
    expect(webkitScrollbar).toContain('display: none;');
  });
});
