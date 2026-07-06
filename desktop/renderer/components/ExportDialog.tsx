import { X } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { ExportPreview, ExportTarget, Prompt } from '../../shared/types';

interface ExportDialogProps {
  prompt: Prompt;
  promptId?: string | null;
  candidateId?: string | null;
  onClose(): void;
  onExported(): Promise<void>;
  onMessage(message: string): void;
}

const TARGETS: Array<{ value: ExportTarget; label: string }> = [
  { value: 'snippet', label: 'Snippet' },
  { value: 'claude-skill', label: 'Claude Skill' },
  { value: 'codex-skill', label: 'Codex Skill' }
];

export function ExportDialog({
  prompt,
  promptId,
  candidateId,
  onClose,
  onExported,
  onMessage
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
      onMessage(`Exported ${result.path}`);
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
            <p className="eyebrow">Preview before write</p>
            <h3>Export {prompt.title}</h3>
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
              {item.label}
            </button>
          ))}
        </div>
        <p className="target-path">{preview?.path}</p>
        <pre className="export-preview">{preview?.content}</pre>
        <div className="button-row end">
          <button className="secondary-button" onClick={onClose} type="button">
            Cancel
          </button>
          <button className="primary-button" disabled={busy} onClick={write} type="button">
            {busy ? 'Writing' : 'Confirm Write'}
          </button>
        </div>
      </section>
    </div>
  );
}
