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
    expect(component).not.toContain('spell-result-trait-more');
    expect(component).not.toContain('hiddenCount');
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
    expect(component).toContain('quick-spell-resizer');
    expect(component).toContain('role="separator"');
    expect(component).toContain('onPointerMove={resizeWithPointer}');
    expect(component).toContain('onKeyDown={resizeWithKeyboard}');
    expect(component).toContain('QUICK_PANEL_MIN_LIST_WIDTH');
    expect(component).toContain('QUICK_PANEL_MIN_DETAIL_WIDTH');
    expect(component).toContain('minWidth: QUICK_PANEL_MIN_WIDTH');
    expect(component).not.toContain('quick-spell-detail-title');
    expect(component).not.toContain('detail-pane');

    expect(app).not.toContain('libraryCreateRequestId');
    expect(app).not.toContain('openNewSpellDraft');
    expect(app).not.toContain('onCreateSpell={openNewSpellDraft}');

    expect(library).toContain('createRequestId');
    expect(library).toContain('openNewSpellEditor();');
    expect(library).toContain('[createRequestId]');
  });

  it('uses a full-width scrollable list with editing in a modal dialog', () => {
    const component = readFileSync('desktop/renderer/components/LibraryView.tsx', 'utf8');
    const editor = readFileSync('desktop/renderer/components/SpellEditorDialog.tsx', 'utf8');
    const styles = readFileSync('desktop/renderer/styles.css', 'utf8');

    expect(component).toContain('spell-library-grid');
    expect(component).toContain('spell-list-pane');
    expect(component).toContain('spell-library-content');
    expect(component).toContain('spell-library-content has-candidates');
    expect(component).toContain('SPELL_LIBRARY_SPLIT_STYLE');
    expect(component).toContain('style={candidates.length ? SPELL_LIBRARY_SPLIT_STYLE : undefined}');
    expect(component).toContain('candidate-dock-header');
    expect(component).toContain('SpellEditorDialog');
    expect(component).not.toContain('spell-editor-pane');
    expect(component).toContain('spell-list-row');
    expect(component).toContain('spell-preview-line');
    expect(component).not.toContain('className="spell-card"');
    expect(editor).toContain('<dialog');
    expect(editor).toContain('dialogRef.current.showModal()');
    expect(editor).toContain('className="spell-editor-dialog"');

    expect(styles.match(/\.spell-library-grid\s*\{[^}]+grid-template-columns: minmax\(0, 1fr\);[^}]+\}/s)?.[0]).toBeTruthy();
    expect(styles.match(/\.spell-library-content\s*\{[^}]+display: grid;[^}]+min-height: 0;[^}]+\}/s)?.[0]).toBeTruthy();
    expect(styles).toContain('.spell-list');
    expect(styles.match(/\.spell-list\s*\{[^}]+overflow: auto;[^}]+\}/s)?.[0]).toBeTruthy();
    expect(styles.match(/\.spell-preview-line\s*\{[^}]+text-overflow: ellipsis;[^}]+\}/s)?.[0]).toBeTruthy();
    expect(styles.match(/\.candidate-dock\s*\{[^}]+grid-template-rows: 42px minmax\(0, 1fr\);[^}]+\}/s)?.[0]).toBeTruthy();
    expect(styles.match(/\.candidate-list\.compact\s*\{[^}]+border: 0;[^}]+\}/s)?.[0]).toBeTruthy();
  });

  it('uses search trait filters name editing and delete confirmation without redundant headings', () => {
    const component = readFileSync('desktop/renderer/components/LibraryView.tsx', 'utf8');
    const editor = readFileSync('desktop/renderer/components/SpellEditorDialog.tsx', 'utf8');
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
    expect(editor).toContain('tag-editor');
    expect(editor).toContain('tag-add-button');
    expect(component).toContain('deleteSpell');
    expect(component).toContain('delete-confirm-popover');
    expect(component).toContain('bulkDeleteActionRef');
    expect(component).toContain("document.addEventListener('pointerdown'");
    expect(component).toContain("window.addEventListener('blur'");
    expect(component).toContain("event.key === 'Escape'");
    expect(component).toContain('onBlur={handleBulkDeleteBlur}');
    expect(component).toContain('aria-haspopup="dialog"');
    expect(component).toContain('role="alertdialog"');
    expect(component).toContain("aria-label={t('spell.deleteConfirm')}");
    expect(component).not.toContain('delete-confirm-message');
    expect(component).not.toContain('delete-confirm-icon');
    expect(component).not.toContain('delete-confirm-actions');
    expect(component).not.toContain("t('spell.deleteConfirmPrompt')");
    expect(editor).toContain('spell.name');
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
    expect(styles).toContain('.delete-confirm-popover::before');
    expect(styles).not.toContain('.delete-confirm-message');
    expect(styles).not.toContain('.delete-confirm-actions');
  });

  it('opens the shared editor dialog for every new-spell request', () => {
    const component = readFileSync('desktop/renderer/components/LibraryView.tsx', 'utf8');
    const editor = readFileSync('desktop/renderer/components/SpellEditorDialog.tsx', 'utf8');
    const styles = readFileSync('desktop/renderer/styles.css', 'utf8');

    expect(component).toContain('openNewSpellEditor');
    expect(component).toContain('createSpell');
    expect(component).toContain("t('spell.new')");
    expect(editor).toContain("t('spell.create')");
    expect(editor).toContain("t('spell.editor.createTitle')");
    expect(component).toContain('aria-label={t(\'spell.new\')}');
    expect(component).toContain('onClick={openNewSpellEditor}');
    expect(component).toContain('openNewSpellEditor();');
    expect(component).not.toContain('startNewSpell');
    expect(component).not.toContain('isCreating');
    expect(editor).toContain('draft.tags.length < MAX_SPELL_TRAITS');
    expect(editor).toContain('current.tags.length >= MAX_SPELL_TRAITS');

    expect(styles).toContain('.spell-library-actions');
    expect(styles).toContain('.new-spell-button');
    expect(styles.match(/\.new-spell-button\s*\{[^}]+height: 34px;[^}]+\}/s)?.[0]).toBeTruthy();
  });

  it('reuses the editor dialog for row editing and protects unsaved changes', () => {
    const component = readFileSync('desktop/renderer/components/LibraryView.tsx', 'utf8');
    const editor = readFileSync('desktop/renderer/components/SpellEditorDialog.tsx', 'utf8');

    expect(component).toContain("type EditorState =");
    expect(component).toContain("{ mode: 'create' }");
    expect(component).toContain("{ mode: 'edit'; spellId: string }");
    expect(component).toContain('openSpellEditor(spell)');
    expect(component).toContain('saveEditorDraft');
    expect(component).toContain('window.spellbook.updateSpell');
    expect(component).toContain('window.spellbook.createSpell');
    expect(editor).toContain("t('spell.editor.editTitle')");
    expect(editor).toContain('event.target === event.currentTarget');
    expect(editor).toContain('onCancel={handleDialogCancel}');
    expect(editor).toContain('isDirty');
    expect(editor).toContain("t('spell.editor.unsaved')");
    expect(editor).toContain("t('spell.editor.discard')");
    expect(editor).toContain("t('spell.editor.continue')");
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

  it('keeps the spell list clear of the window bottom and constrains the editor dialog', () => {
    const styles = readFileSync('desktop/renderer/styles.css', 'utf8');
    const libraryGrid = styles.match(/\.spell-library-grid\s*\{[^}]+\}/s)?.[0] ?? '';
    const listPane = styles.match(/\.spell-list-pane\s*\{[^}]+\}/s)?.[0] ?? '';
    const editorDialog = styles.match(/\.spell-editor-dialog\s*\{[^}]+\}/s)?.[0] ?? '';
    const spellList = styles.match(/\.spell-list\s*\{[^}]+\}/s)?.[0] ?? '';

    expect(libraryGrid).toContain('height: 100%;');
    expect(libraryGrid).not.toContain('calc(100vh - 53px)');
    expect(listPane).toContain('padding: 16px 14px 18px;');
    expect(styles).not.toContain('.spell-editor-pane');
    expect(editorDialog).toContain('width: min(840px, calc(100vw - 48px));');
    expect(editorDialog).toContain('height: min(680px, calc(100vh - 48px));');
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
    const resultList = styles.match(/\.result-list\s*\{[^}]+\}/s)?.[0] ?? '';
    const resultSortHeader = styles.match(/\.result-sort-header\s*\{[^}]+\}/s)?.[0] ?? '';
    const resultRow = styles.match(/\.result-row\s*\{[^}]+\}/s)?.[0] ?? '';
    const resultTitleRow = styles.match(/\.spell-result-title-row\s*\{[^}]+\}/s)?.[0] ?? '';
    const resultName = styles.match(/\.spell-result-name\s*\{[^}]+\}/s)?.[0] ?? '';
    const resultTraits = styles.match(/\.spell-result-traits\s*\{[^}]+\}/s)?.[0] ?? '';
    const resultTrait = styles.match(/\.spell-result-trait\s*\{[^}]+\}/s)?.[0] ?? '';
    const quickDetail = styles.match(/\.quick-spell-detail\s*\{[^}]+\}/s)?.[0] ?? '';
    const quickResizer = styles.match(/\.quick-spell-resizer\s*\{[^}]+\}/s)?.[0] ?? '';
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
    expect(panelGrid).toContain('grid-template-columns: minmax(480px, 3fr) 8px minmax(360px, 2fr);');
    expect(resultHeader).toContain('grid-template-columns: minmax(0, 1fr) 96px 76px 32px;');
    expect(resultList).toContain('gap: 0;');
    expect(resultSortHeader).toContain('justify-content: center;');
    expect(resultRow).toContain('grid-template-columns: minmax(0, 1fr) 96px 76px 32px;');
    expect(resultRow).toContain('min-height: 64px;');
    expect(resultRow).toContain('border-bottom: 1px solid var(--border);');
    expect(resultRow).toContain('border-radius: 0;');
    expect(styles).toContain('.result-row:last-child');
    expect(resultTitleRow).toContain('display: grid;');
    expect(resultName).toContain('white-space: normal;');
    expect(resultName).toContain('overflow-wrap: anywhere;');
    expect(resultTraits).toContain('display: flex;');
    expect(resultTraits).toContain('flex-wrap: wrap;');
    expect(resultTraits).toContain('overflow: visible;');
    expect(resultTraits).not.toContain('justify-content: flex-end;');
    expect(resultTrait).toContain('width: fit-content;');
    expect(resultTrait).toContain('flex: 0 0 auto;');
    expect(quickDetail).not.toContain('border-left');
    expect(quickResizer).toContain('cursor: col-resize;');
    expect(quickResizer).toContain('touch-action: none;');
    expect(quickPreview).toContain('flex: 1 1 auto;');
    expect(quickPreview).toContain('overflow: auto;');
    expect(quickPreview).toContain('font-size: 14px;');
    expect(popover).toContain('position: absolute;');
    expect(popover).toContain('width: 300px;');
    expect(list).toContain('max-height: 240px;');
    expect(list).toContain('overflow: auto;');
    expect(styles).not.toContain('.search-scope-menu-root');
    expect(styles).not.toContain('.trait-filter-menu-root');
    expect(styles).not.toContain('.quick-panel-actions');
  });
});
