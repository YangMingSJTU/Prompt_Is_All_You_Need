import { Clipboard, Plus, Save, X } from 'lucide-react';
import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
  type MouseEvent,
  type SyntheticEvent
} from 'react';
import { MAX_SPELL_TRAITS, type Spell } from '../../shared/types';
import type { TFunction } from '../i18n';
import { deriveSpellName } from '../spellDisplay';

export interface SpellEditorDraft {
  name: string;
  body: string;
  tags: string[];
}

interface SpellEditorDialogProps {
  initialDraft?: SpellEditorDraft;
  mode: 'create' | 'edit';
  spell: Spell | null;
  onClose(): void;
  onCopy?(): Promise<void> | void;
  onSave(draft: SpellEditorDraft): Promise<void>;
  t: TFunction;
}

export function SpellEditorDialog({
  initialDraft: providedInitialDraft,
  mode,
  spell,
  onClose,
  onCopy,
  onSave,
  t
}: SpellEditorDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [initialDraft] = useState<SpellEditorDraft>(() =>
    createDraft(spell, providedInitialDraft)
  );
  const [draft, setDraft] = useState<SpellEditorDraft>(initialDraft);
  const [addingTag, setAddingTag] = useState(false);
  const [newTag, setNewTag] = useState('');
  const [confirmingDiscard, setConfirmingDiscard] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const isDirty = !draftsEqual(draft, initialDraft);
  const hasRequiredBody = draft.body.trim().length > 0;

  useEffect(() => {
    if (dialogRef.current && !dialogRef.current.open) {
      dialogRef.current.showModal();
    }
    return () => {
      if (dialogRef.current?.open) {
        dialogRef.current.close();
      }
    };
  }, []);

  function requestClose(): void {
    if (isSaving) {
      return;
    }
    if (isDirty) {
      setConfirmingDiscard(true);
      return;
    }
    onClose();
  }

  function handleDialogCancel(event: SyntheticEvent<HTMLDialogElement>): void {
    event.preventDefault();
    requestClose();
  }

  function handleBackdropClick(event: MouseEvent<HTMLDialogElement>): void {
    if (event.target === event.currentTarget) {
      requestClose();
    }
  }

  function removeDraftTag(tag: string): void {
    setDraft((current) => ({ ...current, tags: current.tags.filter((item) => item !== tag) }));
  }

  function addDraftTag(): void {
    const normalized = newTag.trim();
    if (normalized) {
      setDraft((current) => ({
        ...current,
        tags:
          current.tags.includes(normalized) || current.tags.length >= MAX_SPELL_TRAITS
            ? current.tags
            : [...current.tags, normalized]
      }));
    }
    setAddingTag(false);
    setNewTag('');
  }

  function handleNewTagKeyDown(event: KeyboardEvent<HTMLInputElement>): void {
    if (event.key === 'Enter') {
      event.preventDefault();
      addDraftTag();
    }
    if (event.key === 'Escape') {
      event.preventDefault();
      event.stopPropagation();
      setAddingTag(false);
      setNewTag('');
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!hasRequiredBody || isSaving) {
      return;
    }
    setIsSaving(true);
    try {
      await onSave(draft);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <dialog
      aria-labelledby="spell-editor-title"
      className="spell-editor-dialog"
      onCancel={handleDialogCancel}
      onClick={handleBackdropClick}
      ref={dialogRef}
    >
      <div className="spell-editor-dialog-shell">
        <header className="spell-editor-dialog-header">
          <h2 id="spell-editor-title">
            {mode === 'create' ? t('spell.editor.createTitle') : t('spell.editor.editTitle')}
          </h2>
          <button
            aria-label={t('spell.editor.close')}
            className="icon-button spell-editor-close"
            disabled={isSaving}
            onClick={requestClose}
            title={t('spell.editor.close')}
            type="button"
          >
            <X size={17} />
          </button>
        </header>

        <form className="spell-editor-form" onSubmit={(event) => void handleSubmit(event)}>
          <div className="spell-editor-dialog-body">
            <label className="field-row">
              <span>{t('spell.name')}</span>
              <input
                autoFocus
                onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
                placeholder={deriveSpellName(draft.body, t('spell.namePlaceholder'))}
                value={draft.name}
              />
            </label>
            <div className="field-row">
              <span>{t('spell.tags')}</span>
              <div className="tag-editor">
                {draft.tags.map((tag) => (
                  <button key={tag} onClick={() => removeDraftTag(tag)} title={tag} type="button">
                    {tag}
                    <X size={12} />
                  </button>
                ))}
                {addingTag && draft.tags.length < MAX_SPELL_TRAITS ? (
                  <input
                    autoFocus
                    onBlur={addDraftTag}
                    onChange={(event) => setNewTag(event.target.value)}
                    onKeyDown={handleNewTagKeyDown}
                    placeholder={t('spell.tagPlaceholder')}
                    value={newTag}
                  />
                ) : draft.tags.length < MAX_SPELL_TRAITS ? (
                  <button className="tag-add-button" onClick={() => setAddingTag(true)} type="button">
                    <Plus size={12} />
                    {t('spell.addTag')}
                  </button>
                ) : null}
              </div>
            </div>
            <label className="field-row fill">
              <span className="required-field-label">
                <span aria-hidden="true" className="required-marker">*</span>
                {t('spell.body')}
              </span>
              <textarea
                onChange={(event) => setDraft((current) => ({ ...current, body: event.target.value }))}
                required
                value={draft.body}
              />
            </label>
          </div>

          {confirmingDiscard ? (
            <footer className="spell-editor-dialog-footer spell-editor-discard" role="alert">
              <span>{t('spell.editor.unsaved')}</span>
              <div className="button-row end">
                <button
                  className="secondary-button"
                  onClick={() => setConfirmingDiscard(false)}
                  type="button"
                >
                  {t('spell.editor.continue')}
                </button>
                <button className="danger-confirm-button" onClick={onClose} type="button">
                  {t('spell.editor.discard')}
                </button>
              </div>
            </footer>
          ) : (
            <footer className="spell-editor-dialog-footer">
              <div>
                {mode === 'edit' && onCopy ? (
                  <button
                    className="secondary-button"
                    disabled={isSaving}
                    onClick={() => void onCopy()}
                    type="button"
                  >
                    <Clipboard size={16} />
                    {t('spell.copy')}
                  </button>
                ) : null}
              </div>
              <div className="button-row end">
                <button className="secondary-button" disabled={isSaving} onClick={requestClose} type="button">
                  {t('spell.cancel')}
                </button>
                <button className="primary-button" disabled={!hasRequiredBody || isSaving} type="submit">
                  <Save size={16} />
                  {mode === 'create' ? t('spell.create') : t('spell.save')}
                </button>
              </div>
            </footer>
          )}
        </form>
      </div>
    </dialog>
  );
}

function createDraft(
  spell: Spell | null,
  providedDraft?: SpellEditorDraft
): SpellEditorDraft {
  if (providedDraft) {
    return {
      name: providedDraft.name,
      body: providedDraft.body,
      tags: providedDraft.tags.slice(0, MAX_SPELL_TRAITS)
    };
  }
  return {
    name: spell?.name ?? '',
    body: spell?.body ?? '',
    tags: spell?.tags.slice(0, MAX_SPELL_TRAITS) ?? []
  };
}

function draftsEqual(left: SpellEditorDraft, right: SpellEditorDraft): boolean {
  return (
    left.name === right.name &&
    left.body === right.body &&
    left.tags.length === right.tags.length &&
    left.tags.every((tag, index) => tag === right.tags[index])
  );
}
