import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('spell library UI structure', () => {
  it('keeps the quick panel focused on search filters sorting and copying', () => {
    const component = readFileSync('desktop/renderer/components/SpellPanel.tsx', 'utf8');
    const listPrimitives = readFileSync(
      'desktop/renderer/components/SpellListPrimitives.tsx',
      'utf8'
    );
    const sortLogic = readFileSync('desktop/renderer/spellSort.ts', 'utf8');
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
    expect(component).toContain('filterSpells');
    expect(component).toContain('getSpellFilterTags');
    expect(component).toContain('sortSpellsByTableState');
    expect(component).toContain('SpellListSortHeader');
    expect(component).toContain('SpellIdentity');
    expect(component).toContain('DEFAULT_SPELL_TABLE_SORT_STATE');
    expect(component).toContain('toggleSort');
    expect(listPrimitives).toContain('spell-sort-header');
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
    expect(component).toContain('getSpellDisplayName');
    expect(component).not.toContain('spell.tags.some');
    expect(component).not.toContain('count-pill');
    expect(component).not.toContain("t('metric.spells')");
    expect(component).toContain('result-list-header');
    expect(listPrimitives).toContain("t('spell.usageCount')");
    expect(listPrimitives).toContain("t('spell.updatedAt')");
    expect(listPrimitives).toContain('mode="usage"');
    expect(listPrimitives).toContain('mode="updated"');
    expect(listPrimitives).not.toContain('mode="created"');
    expect(sortLogic).toContain('getNextSpellTableSortState');
    expect(sortLogic).toContain("defaultDirection === 'asc' ? 'desc' : 'asc'");
    expect(sortLogic).toContain('return DEFAULT_SPELL_TABLE_SORT_STATE');
    expect(listPrimitives).toContain("sortState.direction === 'asc' ? ArrowUp : ArrowDown");
    expect(component).not.toContain('spell-result-text');
    expect(component).not.toContain('renderSpellTraits');
    expect(listPrimitives).toContain('spell-identity-tags');
    expect(component).toContain('spell-list-usage');
    expect(component).toContain('spell-list-updated');
    expect(component).toContain('formatSpellUpdatedAt(spell.updatedAt)');
    expect(listPrimitives.indexOf("t('spell.updatedAt')")).toBeLessThan(
      listPrimitives.indexOf("t('spell.usageCount')")
    );
    expect(component.indexOf('<span className="spell-list-updated"')).toBeLessThan(
      component.indexOf('<span className="spell-list-usage"')
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
    const listPaneLayout =
      component.match(/<div className="spell-list-pane">[\s\S]*?<div className="spell-list"/)?.[0] ?? '';

    expect(component).toContain('spell-library-grid');
    expect(component).toContain('spell-list-pane');
    expect(component).toContain('spell-library-content');
    expect(component).toContain("recommendationPanelOpen ? 'has-recommendations'");
    expect(component).toContain('function RecommendationPanelToggle');
    expect(component).toContain('aria-expanded={open}');
    expect(component).toContain('aria-pressed={open}');
    expect(component).toContain('onClick={() => void onChange(!open)}');
    expect(component).toContain('PanelRightOpen');
    expect(component).toContain('PanelRightClose');
    expect(component).toContain("t('library.candidates')");
    expect(component).toContain('className="spell-library-resizer"');
    expect(component).toContain('calculateSplitRatio');
    expect(component).toContain('clampSplitRatio');
    expect(component).toContain('SPELL_LIBRARY_MIN_LIST_WIDTH');
    expect(component).toContain('SPELL_LIBRARY_MIN_CANDIDATE_WIDTH');
    expect(component).not.toContain('SPELL_LIBRARY_SPLIT_STYLE');
    expect(component).toContain('candidate-dock-header');
    expect(component).toContain('{pendingCandidates.length > 0 ? (');
    expect(component).toContain('onClick={onOpenRecommendationDiscovery}');
    expect(component).toContain('<ScanSearch');
    expect(component).toContain("t('library.find')");
    expect(component).not.toContain("t('library.discover')");
    expect(component).toContain("'candidate-list compact empty'");
    expect(component).toContain('className="candidate-empty-state"');
    expect(component).toContain("t('library.emptyRecommendationsTitle')");
    expect(component).not.toContain('emptyRecommendationsDescription');
    expect(component).toContain('className="candidate-empty-wand"');
    expect(component).toContain('candidate-empty-spark-top');
    expect(component).toContain('candidate-empty-spark-bottom');
    expect(listPaneLayout).toContain('spell-library-toolbar');
    expect(listPaneLayout).toContain('SpellSearchFilter');
    expect(listPaneLayout).not.toContain('SpellSortMenu');
    expect(listPaneLayout).toContain('new-spell-button');
    expect(component).toContain('SpellListSortHeader');
    expect(component).toContain('className="spell-library-list-header"');
    expect(component).toContain('hasLeadingCell');
    expect(component).toContain(
      'useState<SpellTableSortState>(DEFAULT_SPELL_TABLE_SORT_STATE)'
    );
    expect(component).toContain('SpellEditorDialog');
    expect(component).not.toContain('spell-editor-pane');
    expect(component).toContain('spell-list-row');
    expect(component).toContain('SpellIdentity');
    expect(component).toContain('spell-list-updated');
    expect(component).toContain('spell-list-usage');
    expect(component).not.toContain('spell-preview-line');
    expect(component).not.toContain('formatPreview');
    expect(component).not.toContain('className="spell-card"');
    expect(editor).toContain('<dialog');
    expect(editor).toContain('dialogRef.current.showModal()');
    expect(editor).toContain('className="spell-editor-dialog"');

    expect(styles.match(/\.spell-library-grid\s*\{[^}]+grid-template-columns: minmax\(0, 1fr\);[^}]+\}/s)?.[0]).toBeTruthy();
    expect(styles.match(/\.spell-library-content\s*\{[^}]+display: grid;[^}]+min-height: 0;[^}]+\}/s)?.[0]).toBeTruthy();
    expect(styles).toContain('.spell-list');
    expect(styles.match(/\.spell-list\s*\{[^}]+overflow: auto;[^}]+\}/s)?.[0]).toBeTruthy();
    expect(styles.match(/\.spell-list-row\s*\{[^}]+min-height: 52px;[^}]+\}/s)?.[0]).toBeTruthy();
    expect(
      styles.match(
        /\.spell-list-row\s*\{[^}]+grid-template-columns: 24px minmax\(0, 1fr\) 80px 80px 68px;[^}]+\}/s
      )?.[0]
    ).toBeTruthy();
    expect(
      styles.match(/\.spell-library-list-header\s*\{[^}]+top: 42px;[^}]+\}/s)?.[0]
    ).toBeTruthy();
    expect(styles.match(/\.spell-library-resizer\s*\{[^}]+cursor: col-resize;[^}]+\}/s)?.[0]).toBeTruthy();
    expect(styles.match(/\.candidate-dock\s*\{[^}]+grid-template-rows: 42px minmax\(0, 1fr\);[^}]+\}/s)?.[0]).toBeTruthy();
    expect(styles.match(/\.recommendation-panel-toggle\s*\{[^}]+width: 34px;[^}]+height: 34px;[^}]+\}/s)?.[0]).toBeTruthy();
    expect(styles.match(/\.recommendation-panel-toggle\.active\s*\{[^}]+background: var\(--primary\);[^}]+color: var\(--primary-text\);[^}]+\}/s)?.[0]).toBeTruthy();
    expect(component).toContain('candidateDockRef.current?.getBoundingClientRect().width');
    expect(component).toContain('onRecommendationPanelOpenChange(open, panelWidth)');
    expect(styles.match(/\.candidate-discover-button\s*\{[^}]+height: 28px;[^}]+\}/s)?.[0]).toBeTruthy();
    expect(styles.match(/\.candidate-list\.compact\.empty\s*\{[^}]+display: flex;[^}]+align-items: center;[^}]+justify-content: center;[^}]+\}/s)?.[0]).toBeTruthy();
    expect(styles.match(/\.candidate-empty-state\s*\{[^}]+width: 100%;[^}]+height: auto;[^}]+\}/s)?.[0]).toBeTruthy();
    expect(styles).toContain('@keyframes candidate-wand-float');
    expect(styles).toContain('@keyframes candidate-spark-twinkle');
    expect(styles).not.toContain('.candidate-empty-sheet');
    expect(styles.match(/\.candidate-list\.compact\s*\{[^}]+border: 0;[^}]+\}/s)?.[0]).toBeTruthy();
  });

  it('uses search trait filters name editing and delete confirmation without redundant headings', () => {
    const component = readFileSync('desktop/renderer/components/LibraryView.tsx', 'utf8');
    const editor = readFileSync('desktop/renderer/components/SpellEditorDialog.tsx', 'utf8');
    const searchFilter = readFileSync('desktop/renderer/components/SpellSearchFilter.tsx', 'utf8');
    const styles = readFileSync('desktop/renderer/styles.css', 'utf8');

    expect(component).toContain('spell-library-toolbar');
    expect(component).toContain('SpellSearchFilter');
    expect(component).toContain('filterSpells');
    expect(component).toContain('getSpellFilterTags');
    expect(component).toContain('searchScope');
    expect(component).not.toContain('SpellSortMenu');
    expect(component).toContain('sortSpellsByTableState');
    expect(component).toContain('getNextSpellTableSortState');
    expect(component).not.toContain('variant="button"');
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
    expect(styles).not.toContain('.spell-library-actions');
    expect(styles).toContain('.spell-library-list-header');
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
    const nameField = editor.match(/<label className="field-row">[\s\S]*?<\/label>/)?.[0] ?? '';
    const bodyField = editor.match(/<label className="field-row fill">[\s\S]*?<\/label>/)?.[0] ?? '';

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
    expect(nameField).not.toContain('required');
    expect(bodyField).toContain('className="required-field-label"');
    expect(bodyField).toContain('aria-hidden="true"');
    expect(bodyField).toContain('className="required-marker"');
    expect(bodyField).toContain('required');
    expect(editor).toContain('hasRequiredBody');

    expect(styles).not.toContain('.spell-library-actions');
    expect(styles).toContain('.new-spell-button');
    expect(styles).toContain('.field-row .required-marker');
    expect(styles).not.toContain('.required-field-label::after');
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
    expect(editor).not.toContain('initialBody');
  });

  it('opens candidate creation in the shared editor and exposes persistent favorite controls', () => {
    const component = readFileSync('desktop/renderer/components/LibraryView.tsx', 'utf8');
    const panel = readFileSync('desktop/renderer/components/SpellPanel.tsx', 'utf8');
    const filter = readFileSync('desktop/renderer/components/SpellSearchFilter.tsx', 'utf8');
    const searchLogic = readFileSync('desktop/renderer/spellSearch.ts', 'utf8');
    const preload = readFileSync('desktop/main/preload.ts', 'utf8');
    const globals = readFileSync('desktop/renderer/global.d.ts', 'utf8');
    const main = readFileSync('desktop/main/index.ts', 'utf8');

    expect(component).toContain("candidate.status === 'pending'");
    expect(component).toContain('openCandidateEditor');
    expect(component).toContain('initialDraft');
    expect(component).toContain('window.spellbook.createSpellFromCandidate');
    expect(component).toContain('window.spellbook.updateSpellState');
    expect(component).toContain('aria-pressed={spell.isFavorite}');
    expect(component).not.toContain('spell-row-menu');
    expect(component).not.toContain('blockSpell');
    expect(component).not.toContain('restoreSpell');
    expect(component).not.toContain('isBlocked');
    expect(panel).toContain('aria-pressed={spell.isFavorite}');
    expect(panel).toMatch(
      /<Heart fill=\{selected\.isFavorite[\s\S]*?\/?>\s*\{t\(selected\.isFavorite \? 'spell\.unfavorite' : 'spell\.favorite'\)\}/
    );
    expect(panel).toContain('statusFilter');
    expect(searchLogic).toContain("export type SpellStatusFilter = 'active' | 'favorite'");
    expect(filter).toContain("import type { SearchScope, SpellStatusFilter } from '../spellSearch'");
    expect(filter).toContain("onStatusChange('active')");
    expect(filter).not.toContain('blocked');
    expect(filter).not.toContain('showBlockedStatus');
    expect(preload).toContain('createSpellFromCandidate');
    expect(preload).toContain('updateSpellState');
    expect(globals).toContain('createSpellFromCandidate(candidateId: string, input: SpellCreateInput)');
    expect(globals).toContain('updateSpellState(spellId: string, patch: SpellStatePatch)');
    expect(main).toContain("'candidates:createSpell'");
    expect(main).toContain("'spells:updateState'");
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
    expect(component.match(/type="checkbox"/g)).toHaveLength(4);
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
    expect(styles.match(/\.spell-select-all\s*\{[^}]+padding-left: 4px;[^}]+\}/s)?.[0]).toBeTruthy();
    expect(styles).not.toContain('.spell-bulk-toolbar');
    expect(styles).toContain('.spell-row-select');
    expect(preload).toContain('deleteSpells');
    expect(globals).toContain('deleteSpells(spellIds: string[])');
  });

  it('offers matching batch selection and save controls for recommended spells', () => {
    const component = readFileSync('desktop/renderer/components/LibraryView.tsx', 'utf8');
    const styles = readFileSync('desktop/renderer/styles.css', 'utf8');
    const candidateList = styles.match(/\.candidate-list\.compact\s*\{[^}]+\}/s)?.[0] ?? '';
    const candidateRow = styles.match(/\.candidate-row\s*\{[^}]+\}/s)?.[0] ?? '';
    const candidateRowSelect = styles.match(/\.candidate-row-select\s*\{[^}]+\}/s)?.[0] ?? '';
    const candidateContent = styles.match(/\.candidate-row-content\s*\{[^}]+\}/s)?.[0] ?? '';
    const candidateMeta = styles.match(/\.candidate-row-meta\s*\{[^}]+\}/s)?.[0] ?? '';

    expect(component).toContain('selectedCandidateIds');
    expect(component).toContain('toggleCandidateSelection');
    expect(component).toContain('togglePendingCandidateSelection');
    expect(component).toContain('saveSelectedCandidates');
    expect(component).toContain('window.spellbook.promoteCandidates(selectedPendingCandidateIds)');
    expect(component).toContain('selectAllCandidatesCheckboxRef.current.indeterminate');
    expect(component).toContain('candidate-selection-toolbar');
    expect(component).toContain('candidate-row-select');
    expect(component).toContain('candidate-row-meta');
    expect(component).toContain('candidate-row-actions');
    expect(component).toContain("aria-label={t('spell.save')}");
    expect(component).toContain("title={t('spell.save')}");
    expect(component).toContain('onClick={() => openCandidateEditor(candidate)}');
    expect(component).toContain("candidate.sourceCount} {t('metric.sources')}");
    expect(component).not.toContain('candidate.score');
    expect(component).not.toContain("t('metric.score')");
    expect(component).toContain('openCandidateEditor');
    expect(component).toContain("{t('library.save')}");
    expect(component).toContain("t('library.saveSelected')");
    expect(component).toContain("t('library.selectedSaved')");
    expect(styles).toContain('.candidate-row.bulk-selected');
    expect(candidateList).toContain('--candidate-row-min-height: 64px;');
    expect(candidateList).toContain('--candidate-row-max-height: 144px;');
    expect(candidateList).toContain('grid-auto-rows: max-content;');
    expect(candidateRow).toContain('grid-template-columns: 24px minmax(0, 1fr) 72px 28px;');
    expect(candidateRow).toContain('min-height: var(--candidate-row-min-height);');
    expect(candidateRow).toContain('max-height: var(--candidate-row-max-height);');
    expect(candidateRowSelect).toContain('align-self: start;');
    expect(candidateRowSelect).toContain('height: 28px;');
    expect(candidateContent).toContain('max-height: calc(var(--candidate-row-max-height) - 20px);');
    expect(candidateContent).toContain('overflow-y: auto;');
    expect(candidateContent).toContain('padding-top: 4px;');
    expect(candidateMeta).toContain('height: 28px;');
    expect(candidateMeta).toContain('align-items: center;');
  });

  it('keeps the spell list clear of the window bottom and constrains the editor dialog', () => {
    const styles = readFileSync('desktop/renderer/styles.css', 'utf8');
    const libraryGrid = styles.match(/\.spell-library-grid\s*\{[^}]+\}/s)?.[0] ?? '';
    const listPane = styles.match(/\.spell-list-pane\s*\{[^}]+\}/s)?.[0] ?? '';
    const editorDialog = styles.match(/\.spell-editor-dialog\s*\{[^}]+\}/s)?.[0] ?? '';
    const spellList = styles.match(/\.spell-list\s*\{[^}]+\}/s)?.[0] ?? '';

    expect(libraryGrid).toContain('height: 100%;');
    expect(libraryGrid).not.toContain('calc(100vh - 53px)');
    expect(libraryGrid).toContain('padding: 16px 14px 18px;');
    expect(listPane).not.toContain('padding: 16px 14px 18px;');
    expect(styles).not.toContain('.spell-editor-pane');
    expect(editorDialog).toContain('width: min(760px, calc(100vw - 64px));');
    expect(editorDialog).toContain('height: min(580px, calc(100vh - 64px));');
    expect(spellList).toContain('flex: 1 1 auto;');
    expect(spellList).toContain('min-height: 0;');
    expect(spellList).toContain('overflow: auto;');
  });

  it('uses one filter dialog with search scope and sortable result headers', () => {
    const app = readFileSync('desktop/renderer/App.tsx', 'utf8');
    const component = readFileSync('desktop/renderer/components/SpellPanel.tsx', 'utf8');
    const listPrimitives = readFileSync(
      'desktop/renderer/components/SpellListPrimitives.tsx',
      'utf8'
    );
    const searchFilter = readFileSync('desktop/renderer/components/SpellSearchFilter.tsx', 'utf8');
    const styles = readFileSync('desktop/renderer/styles.css', 'utf8');
    const controls = styles.match(/\.quick-panel-controls\s*\{[^}]+\}/s)?.[0] ?? '';
    const searchGroup = styles.match(/\.spell-search-filter\s*\{[^}]+\}/s)?.[0] ?? '';
    const filterButton = styles.match(/\.spell-filter-button\s*\{[^}]+\}/s)?.[0] ?? '';
    const panelGrid = styles.match(/\.panel-grid\s*\{[^}]+\}/s)?.[0] ?? '';
    const sharedHeader = styles.match(/\.spell-list-sort-header\s*\{[^}]+\}/s)?.[0] ?? '';
    const resultHeader = styles.match(/\.result-list-header\s*\{[^}]+\}/s)?.[0] ?? '';
    const resultList = styles.match(/\.result-list\s*\{[^}]+\}/s)?.[0] ?? '';
    const sortHeader = styles.match(/\.spell-sort-header\s*\{[^}]+\}/s)?.[0] ?? '';
    const resultRow = styles.match(/\.result-row\s*\{[^}]+\}/s)?.[0] ?? '';
    const spellIdentity = styles.match(/\.spell-identity\s*\{[^}]+\}/s)?.[0] ?? '';
    const identityName = styles.match(/\.spell-identity-name\s*\{[^}]+\}/s)?.[0] ?? '';
    const identityTags = styles.match(/\.spell-identity-tags\s*\{[^}]+\}/s)?.[0] ?? '';
    const identityTag = styles.match(/\.spell-identity-tag\s*\{[^}]+\}/s)?.[0] ?? '';
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
    expect(component).toContain('SpellListSortHeader');
    expect(component).toContain('SpellIdentity');
    expect(listPrimitives).toContain('mode="name"');
    expect(listPrimitives).toContain('mode="updated"');
    expect(listPrimitives).toContain('mode="usage"');
    expect(listPrimitives).not.toContain('mode="created"');
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
    expect(resultHeader).toContain('grid-template-columns: minmax(0, 1fr) 96px 76px 68px;');
    expect(sharedHeader).toContain('font-size: 12px;');
    expect(resultList).toContain('gap: 0;');
    expect(sortHeader).toContain('justify-content: center;');
    expect(sortHeader).toContain('font-size: 12px;');
    expect(resultRow).toContain('grid-template-columns: minmax(0, 1fr) 96px 76px 68px;');
    expect(resultRow).toContain('min-height: 52px;');
    expect(resultRow).toContain('border-bottom: 1px solid var(--border);');
    expect(resultRow).toContain('border-radius: 0;');
    expect(styles).toContain('.result-row:last-child');
    expect(spellIdentity).toContain('display: flex;');
    expect(spellIdentity).toContain('overflow: hidden;');
    expect(identityName).toContain('font-weight: 600;');
    expect(identityName).toContain('white-space: nowrap;');
    expect(identityTags).toContain('display: flex;');
    expect(identityTags).toContain('overflow: hidden;');
    expect(identityTag).toContain('max-width: 96px;');
    expect(identityTag).toContain('height: 20px;');
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
