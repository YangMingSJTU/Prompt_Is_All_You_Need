import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('spell library UI structure', () => {
  it('keeps the quick panel focused on search filters sorting and copying', () => {
    const component = readFileSync('desktop/renderer/components/SpellPanel.tsx', 'utf8');
    const app = readFileSync('desktop/renderer/App.tsx', 'utf8');
    const library = readFileSync('desktop/renderer/components/LibraryView.tsx', 'utf8');

    expect(component).not.toContain('onCreateSpell');
    expect(component).not.toContain("t('spell.new')");
    expect(component).toContain('selectedTags');
    expect(component).toContain('allTags');
    expect(component).toContain("t('spell.allTags')");
    expect(component).toContain('SearchScopeMenu');
    expect(component).toContain('searchScope');
    expect(component).toContain('matchesSpellSearch');
    expect(component).toContain('SpellSortMenu');
    expect(component).toContain('sortSpells');
    expect(component).toContain('variant="button"');
    expect(component).toContain('quick-panel-controls');
    expect(component).toContain('quick-panel-actions');
    expect(component).toContain('TraitFilterMenu');
    expect(component).not.toContain('pane-toolbar');
    expect(component).not.toContain('quick-panel-traits');
    expect(component).not.toContain('toolbar-actions');
    expect(component).toContain('deriveSpellName');
    expect(component).not.toContain('spell.tags.some');
    expect(component).not.toContain('count-pill');
    expect(component).not.toContain("t('metric.spells')");
    expect(component).toContain('spell-result-text');
    expect(component).toContain('spell-result-traits');
    expect(component).toContain('spell-result-actions');
    expect(component).toContain('copySelected(spell)');
    expect(component).not.toContain('detail-pane');

    expect(app).not.toContain('libraryCreateRequestId');
    expect(app).not.toContain('openNewSpellDraft');
    expect(app).not.toContain('onCreateSpell={openNewSpellDraft}');

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

  it('offers batch selection and deletion for visible spell rows', () => {
    const component = readFileSync('desktop/renderer/components/LibraryView.tsx', 'utf8');
    const styles = readFileSync('desktop/renderer/styles.css', 'utf8');
    const preload = readFileSync('desktop/main/preload.ts', 'utf8');
    const globals = readFileSync('desktop/renderer/global.d.ts', 'utf8');

    expect(component).toContain('selectedSpellIds');
    expect(component).toContain('toggleSpellSelection');
    expect(component).toContain('toggleFilteredSpellSelection');
    expect(component).toContain('deleteSelectedSpells');
    expect(component).toContain('window.spellbook.deleteSpells');
    expect(component).toContain('className="spell-selection-toolbar"');
    expect(component).toContain('className="spell-select-all"');
    expect(component).toContain('className="spell-row-select"');
    expect(component.match(/type="checkbox"/g)).toHaveLength(2);
    expect(component).toContain('selectAllCheckboxRef.current.indeterminate');
    expect(component).toContain("t('spell.selectAll')");
    expect(component).toContain("t('spell.clearSelection')");
    expect(component).toContain("t('spell.delete')");
    expect(component).not.toContain("t('spell.selectedCount')");
    expect(component).not.toContain("t('spell.deleteSelected')");
    expect(component).not.toContain('window.spellbook.deleteSpell(');
    expect(component).not.toContain('async function deleteSpell()');
    expect(styles).toContain('.spell-selection-toolbar');
    expect(styles).toContain('.spell-select-all');
    expect(styles).not.toContain('.spell-bulk-toolbar');
    expect(styles).toContain('.spell-row-select');
    expect(preload).toContain('deleteSpells');
    expect(globals).toContain('deleteSpells(spellIds: string[])');
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

  it('uses full width quick panel rows with search scope and visible traits', () => {
    const app = readFileSync('desktop/renderer/App.tsx', 'utf8');
    const component = readFileSync('desktop/renderer/components/SpellPanel.tsx', 'utf8');
    const styles = readFileSync('desktop/renderer/styles.css', 'utf8');
    const controls = styles.match(/\.quick-panel-controls\s*\{[^}]+\}/s)?.[0] ?? '';
    const actions = styles.match(/\.quick-panel-actions\s*\{[^}]+\}/s)?.[0] ?? '';
    const panelGrid = styles.match(/\.panel-grid\s*\{[^}]+\}/s)?.[0] ?? '';
    const scopeControl = styles.match(/\.search-scope-control\s*\{[^}]+\}/s)?.[0] ?? '';
    const resultRow = styles.match(/\.result-row\s*\{[^}]+\}/s)?.[0] ?? '';
    const resultTraits = styles.match(/\.spell-result-traits\s*\{[^}]+\}/s)?.[0] ?? '';
    const resultTrait = styles.match(/\.spell-result-trait\s*\{[^}]+\}/s)?.[0] ?? '';
    const workspace = styles.match(/\.workspace\s*\{[^}]+\}/s)?.[0] ?? '';
    const popover = styles.match(/\.trait-filter-popover\s*\{[^}]+\}/s)?.[0] ?? '';
    const list = styles.match(/\.trait-filter-list\s*\{[^}]+\}/s)?.[0] ?? '';

    expect(app).not.toContain('className="topbar"');
    expect(app).not.toContain('topbar-title');
    expect(component).not.toContain('<h3>{t(\'nav.panel\')}</h3>');
    expect(component).toContain('TraitFilterMenu');
    expect(component).toContain('SearchScopeMenu');
    expect(component).toContain('traitFilterQuery');
    expect(component).toContain('setSelectedTags([])');
    expect(component).toContain('selectedTags.length ?');
    expect(component).toContain('role="menuitemcheckbox"');
    expect(component).toContain('aria-checked');
    expect(component).not.toContain('quick-panel-traits');
    expect(workspace).not.toContain('grid-template-rows: 53px minmax(0, 1fr)');
    expect(controls).toContain('display: grid;');
    expect(controls).toContain('grid-template-rows: auto auto;');
    expect(actions).toContain('display: flex;');
    expect(panelGrid).toContain('grid-template-columns: minmax(0, 1fr);');
    expect(scopeControl).toContain('grid-template-columns: minmax(0, 1fr) auto;');
    expect(resultRow).toContain('grid-template-columns: minmax(0, 1fr) auto auto;');
    expect(resultTraits).toContain('display: flex;');
    expect(resultTrait).toContain('width: fit-content;');
    expect(popover).toContain('position: absolute;');
    expect(list).toContain('max-height: 240px;');
    expect(list).toContain('overflow: auto;');
  });
});
