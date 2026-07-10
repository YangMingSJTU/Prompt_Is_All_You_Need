import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('spell library UI structure', () => {
  it('keeps the quick panel focused on search filters sorting and copying', () => {
    const component = readFileSync('desktop/renderer/components/SpellPanel.tsx', 'utf8');
    const searchFilter = readFileSync('desktop/renderer/components/SpellSearchFilter.tsx', 'utf8');
    const app = readFileSync('desktop/renderer/App.tsx', 'utf8');
    const library = readFileSync('desktop/renderer/components/LibraryView.tsx', 'utf8');

    expect(component).not.toContain('onCreateSpell');
    expect(component).not.toContain("t('spell.new')");
    expect(component).toContain('selectedTags');
    expect(component).toContain('allTags');
    expect(component).toContain('SpellSearchFilter');
    expect(searchFilter).toContain('<Funnel size={16} />');
    expect(component).toContain('searchScope');
    expect(component).toContain('matchesSpellSearch');
    expect(component).toContain('sortSpells');
    expect(component).toContain('SortHeaderButton');
    expect(component).toContain('DEFAULT_SORT_DIRECTIONS');
    expect(component).toContain('toggleSort');
    expect(component).toContain('result-sort-header');
    expect(component).toContain('quick-panel-controls');
    expect(searchFilter).toContain('spell-search-filter');
    expect(searchFilter).toContain('aria-haspopup="dialog"');
    expect(searchFilter).toContain('role="dialog"');
    expect(searchFilter).toContain('role="radiogroup"');
    expect(searchFilter).toContain('role="radio"');
    expect(searchFilter).toContain('role="checkbox"');
    expect(component).not.toContain('SearchScopeMenu');
    expect(component).not.toContain('TraitFilterMenu');
    expect(component).not.toContain('filter-badge');
    expect(component).not.toContain('pane-toolbar');
    expect(component).not.toContain('quick-panel-traits');
    expect(component).not.toContain('toolbar-actions');
    expect(component).toContain('deriveSpellName');
    expect(component).not.toContain('spell.tags.some');
    expect(component).not.toContain('count-pill');
    expect(component).not.toContain("t('metric.spells')");
    expect(component).toContain('result-list-header');
    expect(component).toContain("t('spell.usageCount')");
    expect(component).toContain("t('spell.updatedAt')");
    expect(component).toContain('spell-result-title-row');
    expect(component).toContain('mode="usage"');
    expect(component).toContain('mode="updated"');
    expect(component).toContain('setSortDirection(defaultDirection)');
    expect(component).toContain("defaultDirection === 'asc' ? 'desc' : 'asc'");
    expect(component).toContain('sortDirection === DEFAULT_SORT_DIRECTIONS[mode]');
    expect(component).toContain('isDefaultDirection ? ArrowDown : ArrowUp');
    expect(component).toContain('setSortMode(null)');
    expect(component).toContain('setSortDirection(null)');
    expect(component).not.toContain('spell-result-text');
    expect(component).toContain('spell-result-traits');
    expect(component).toContain('spell-result-usage');
    expect(component).toContain('spell-result-updated');
    expect(component).toContain('formatUpdatedAt(spell.updatedAt)');
    expect(component.indexOf('label={t(\'spell.updatedAt\')}')).toBeLessThan(
      component.indexOf('label={t(\'spell.usageCount\')}')
    );
    expect(component.indexOf('<span className="spell-result-updated"')).toBeLessThan(
      component.indexOf('<span className="spell-result-usage"')
    );
    expect(component).toContain('spell-result-actions');
    expect(component).toContain('copySelected(spell)');
    expect(component).toContain('quick-spell-detail');
    expect(component).toContain('quick-spell-preview');
    expect(component).toContain('getSpellDisplayText(selected)');
    expect(component).toContain('copySelected(selected)');
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
    const searchFilter = readFileSync('desktop/renderer/components/SpellSearchFilter.tsx', 'utf8');
    const styles = readFileSync('desktop/renderer/styles.css', 'utf8');

    expect(component).toContain('spell-library-toolbar');
    expect(component).toContain('SpellSearchFilter');
    expect(component).toContain('matchesSpellSearch');
    expect(component).toContain('searchScope');
    expect(component).toContain('SpellSortMenu');
    expect(component).toContain('sortSpells');
    expect(component).toContain('variant="button"');
    expect(component).not.toContain('tag-filter-row');
    expect(component).toContain('selectedTags');
    expect(searchFilter).toContain('spell-filter-popover');
    expect(searchFilter).toContain('spell-filter-trait-list');
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
    expect(styles).toContain('.spell-search-filter');
    expect(styles).toContain('.spell-library-actions');
    expect(styles).not.toContain('.tag-filter-row');
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
    expect(component).toContain("setSearchScope('title-content')");

    expect(styles).toContain('.spell-library-actions');
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

  it('uses one filter dialog with search scope and sortable result headers', () => {
    const app = readFileSync('desktop/renderer/App.tsx', 'utf8');
    const component = readFileSync('desktop/renderer/components/SpellPanel.tsx', 'utf8');
    const searchFilter = readFileSync('desktop/renderer/components/SpellSearchFilter.tsx', 'utf8');
    const styles = readFileSync('desktop/renderer/styles.css', 'utf8');
    const controls = styles.match(/\.quick-panel-controls\s*\{[^}]+\}/s)?.[0] ?? '';
    const searchGroup = styles.match(/\.spell-search-filter\s*\{[^}]+\}/s)?.[0] ?? '';
    const filterButton = styles.match(/\.spell-filter-button\s*\{[^}]+\}/s)?.[0] ?? '';
    const panelGrid = styles.match(/\.panel-grid\s*\{[^}]+\}/s)?.[0] ?? '';
    const resultHeader = styles.match(/\.result-list-header\s*\{[^}]+\}/s)?.[0] ?? '';
    const resultSortHeader = styles.match(/\.result-sort-header\s*\{[^}]+\}/s)?.[0] ?? '';
    const resultRow = styles.match(/\.result-row\s*\{[^}]+\}/s)?.[0] ?? '';
    const resultTitleRow = styles.match(/\.spell-result-title-row\s*\{[^}]+\}/s)?.[0] ?? '';
    const resultTraits = styles.match(/\.spell-result-traits\s*\{[^}]+\}/s)?.[0] ?? '';
    const resultTrait = styles.match(/\.spell-result-trait\s*\{[^}]+\}/s)?.[0] ?? '';
    const quickDetail = styles.match(/\.quick-spell-detail\s*\{[^}]+\}/s)?.[0] ?? '';
    const quickPreview = styles.match(/\.quick-spell-preview\s*\{[^}]+\}/s)?.[0] ?? '';
    const workspace = styles.match(/\.workspace\s*\{[^}]+\}/s)?.[0] ?? '';
    const popover = styles.match(/\.spell-filter-popover\s*\{[^}]+\}/s)?.[0] ?? '';
    const list = styles.match(/\.spell-filter-trait-list\s*\{[^}]+\}/s)?.[0] ?? '';

    expect(app).not.toContain('className="topbar"');
    expect(app).not.toContain('topbar-title');
    expect(component).not.toContain('<h3>{t(\'nav.panel\')}</h3>');
    expect(component).toContain('SpellSearchFilter');
    expect(searchFilter).toContain('traitFilterQuery');
    expect(searchFilter).toContain('resetFilters');
    expect(searchFilter).toContain("onScopeChange('title-content')");
    expect(searchFilter).toContain('onClearTags()');
    expect(searchFilter).toContain('closeFilterMenu');
    expect(searchFilter).toContain("setTraitFilterQuery('')");
    expect(searchFilter).toContain("event.key === 'Escape'");
    expect(searchFilter).toContain("document.addEventListener('pointerdown'");
    expect(searchFilter).toContain('role="checkbox"');
    expect(searchFilter).toContain('aria-checked');
    expect(component).not.toContain('filter-badge');
    expect(component).not.toContain('quick-panel-traits');
    expect(component).not.toContain('quick-panel-actions');
    expect(component).not.toContain('search-scope-menu-root');
    expect(component).not.toContain('trait-filter-menu-root');
    expect(component).not.toContain('className="quick-panel-sort"');
    expect(workspace).not.toContain('grid-template-rows: 53px minmax(0, 1fr)');
    expect(controls).toContain('display: grid;');
    expect(controls).toContain('grid-template-columns: minmax(0, 1fr);');
    expect(searchGroup).toContain('grid-template-columns: minmax(0, 1fr) 34px;');
    expect(filterButton).toContain('width: 34px;');
    expect(panelGrid).toContain('grid-template-columns: minmax(0, 3fr) minmax(320px, 2fr);');
    expect(resultHeader).toContain('grid-template-columns: minmax(0, 1fr) 96px 76px 32px;');
    expect(resultSortHeader).toContain('justify-content: center;');
    expect(resultRow).toContain('grid-template-columns: minmax(0, 1fr) 96px 76px 32px;');
    expect(resultRow).toContain('min-height: 46px;');
    expect(resultTitleRow).toContain('display: flex;');
    expect(resultTraits).toContain('display: flex;');
    expect(resultTraits).not.toContain('justify-content: flex-end;');
    expect(resultTrait).toContain('width: fit-content;');
    expect(quickDetail).toContain('border-left: 1px solid var(--border);');
    expect(quickPreview).toContain('flex: 1 1 auto;');
    expect(quickPreview).toContain('overflow: auto;');
    expect(popover).toContain('position: absolute;');
    expect(popover).toContain('width: 300px;');
    expect(list).toContain('max-height: 240px;');
    expect(list).toContain('overflow: auto;');
    expect(styles).not.toContain('.search-scope-menu-root');
    expect(styles).not.toContain('.trait-filter-menu-root');
    expect(styles).not.toContain('.quick-panel-actions');
  });
});
