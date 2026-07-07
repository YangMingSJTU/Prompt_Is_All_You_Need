import { X } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { ExportPreview, ExportTarget, Prompt } from '../../shared/types';
import type { TFunction } from '../i18n';

interface ExportDialogProps {
  prompt: Prompt;
  promptId?: string | null;
  candidateId?: string | null;
  onClose(): void;
  onExported(): Promise<void>;
  onMessage(message: string): void;
  t: TFunction;
}

const TARGETS: Array<{ value: ExportTarget; labelKey: 'export.snippet' | 'export.claude' | 'export.codex' }> = [
  { value: 'snippet', labelKey: 'export.snippet' },
  { value: 'claude-skill', labelKey: 'export.claude' },
  { value: 'codex-skill', labelKey: 'export.codex' }
];

export function ExportDialog({
  prompt,
  promptId,
  candidateId,
  onClose,
  onExported,
  onMessage,
  t
}: ExportDialogProps) {
  const [target, setTarget] = useState<ExportTarget>('snippet');
  const [preview, setPreview] = useState<ExportPreview | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const exportable = {
      slug: prompt.slug,
      title: prompt.title,
      description: prompt.description,
      body: prompt.body
    };
    void window.apm.previewExport(exportable, target).then(setPreview);
  }, [prompt, target]);

  async function write(): Promise<void> {
    setBusy(true);
    try {
      const result = await window.apm.writeExport(
        {
          slug: prompt.slug,
          title: prompt.title,
          description: prompt.description,
          body: prompt.body
        },
        target,
        undefined,
        promptId,
        candidateId
      );
      onMessage(`${t('status.exported')} ${result.path}`);
      await onExported();
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="modal-backdrop">
      <section className="modal">
        <header className="modal-header">
          <div>
            <p className="eyebrow">{t('export.preview')}</p>
            <h3>{t('export.title')} {prompt.title}</h3>
          </div>
          <button className="icon-button" onClick={onClose} type="button" aria-label="Close">
            <X size={18} />
          </button>
        </header>
        <div className="segmented-control">
          {TARGETS.map((item) => (
            <button
              className={target === item.value ? 'active' : ''}
              key={item.value}
              onClick={() => setTarget(item.value)}
              type="button"
            >
              {t(item.labelKey)}
            </button>
          ))}
        </div>
        <p className="target-path">{preview?.path}</p>
        <pre className="export-preview">{preview?.content}</pre>
        <div className="button-row end">
          <button className="secondary-button" onClick={onClose} type="button">
            {t('export.cancel')}
          </button>
          <button className="primary-button" disabled={busy} onClick={write} type="button">
            {busy ? t('export.writing') : t('export.confirm')}
          </button>
        </div>
      </section>
    </div>
  );
}
