import { Archive, Download, RotateCw } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { SkillPlatform, SkillRecord } from '../../shared/types';
import type { TFunction } from '../i18n';
import { FeedbackTarget, useFeedbackTooltip } from './FeedbackTooltip';

interface SkillLibraryViewProps {
  skills: SkillRecord[];
  onChanged(): Promise<void>;
  t: TFunction;
}

export function SkillLibraryView({ skills, onChanged, t }: SkillLibraryViewProps) {
  const [scanning, setScanning] = useState(false);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const { showFeedback, tooltipFor } = useFeedbackTooltip();
  const summary = useMemo(
    () => ({
      total: skills.length,
      codex: skills.filter((skill) => skill.platform === 'codex').length,
      claude: skills.filter((skill) => skill.platform === 'claude').length,
      packageable: skills.filter((skill) => skill.packageable).length
    }),
    [skills]
  );

  async function scanSkills(): Promise<void> {
    setScanning(true);
    try {
      const result = await window.spellbook.scanSkills();
      showFeedback('skills:scan', `${t('status.skillScanFinished')}: ${result.length}`);
      await onChanged();
    } finally {
      setScanning(false);
    }
  }

  async function packageSkill(skill: SkillRecord): Promise<void> {
    setBusyAction(`${skill.id}:package`);
    try {
      const result = await window.spellbook.packageSkill(skill.id);
      showFeedback(`${skill.id}:package`, `${t('status.packaged')} ${result.path}`);
    } finally {
      setBusyAction(null);
    }
  }

  async function installSkill(skill: SkillRecord, platform: SkillPlatform): Promise<void> {
    setBusyAction(`${skill.id}:install:${platform}`);
    try {
      const result = await window.spellbook.installSkill(skill.id, platform);
      showFeedback(
        `${skill.id}:install:${platform}`,
        result.warning ?? `${t('status.installed')} ${result.path}`
      );
      await onChanged();
    } finally {
      setBusyAction(null);
    }
  }

  return (
    <section className="stack">
      <div className="section-heading">
        <div>
          <h3>{t('skill.title')}</h3>
        </div>
        <FeedbackTarget align="right" message={tooltipFor('skills:scan')}>
          <button className="primary-button" disabled={scanning} onClick={scanSkills} type="button">
            <RotateCw size={16} />
            {scanning ? t('skill.scanning') : t('skill.scan')}
          </button>
        </FeedbackTarget>
      </div>
      <div className="summary-strip">
        <div className="summary-item">
          <span>{t('metric.skills')}</span>
          <strong>{summary.total}</strong>
        </div>
        <div className="summary-item">
          <span>Codex</span>
          <strong>{summary.codex}</strong>
        </div>
        <div className="summary-item">
          <span>Claude</span>
          <strong>{summary.claude}</strong>
        </div>
        <div className="summary-item">
          <span>{t('skill.package')}</span>
          <strong>{summary.packageable}</strong>
        </div>
      </div>
      <div className="skill-table">
        <div className="skill-row skill-header">
          <span>{t('metric.platform')}</span>
          <strong>{t('metric.skills')}</strong>
          <small>{t('skill.files')}</small>
          <b />
        </div>
        {skills.map((skill) => {
          const filePreview = skill.files.slice(0, 4);
          const remaining = Math.max(skill.files.length - filePreview.length, 0);
          return (
            <article className="skill-row" key={skill.id}>
              <span>{formatPlatform(skill.platform)}</span>
              <div className="skill-main">
                <div className="skill-title-line">
                  <strong>{skill.name}</strong>
                  <em>{formatDate(skill.updatedAt)}</em>
                </div>
                <p>{skill.description}</p>
                <code title={skill.rootPath}>{skill.rootPath}</code>
              </div>
              <div className="skill-files" title={skill.files.join('\n')}>
                {filePreview.map((file) => (
                  <code key={file}>{file}</code>
                ))}
                {remaining > 0 ? <code>+{remaining}</code> : null}
              </div>
              <div className="skill-actions">
                <FeedbackTarget message={tooltipFor(`${skill.id}:package`)}>
                  <button
                    className="secondary-button"
                    disabled={!skill.packageable || busyAction !== null}
                    onClick={() => void packageSkill(skill)}
                    type="button"
                  >
                    <Archive size={15} />
                    {t('skill.package')}
                  </button>
                </FeedbackTarget>
                <FeedbackTarget message={tooltipFor(`${skill.id}:install:claude`)}>
                  <button
                    className="secondary-button"
                    disabled={busyAction !== null}
                    onClick={() => void installSkill(skill, 'claude')}
                    type="button"
                  >
                    <Download size={15} />
                    {t('skill.installClaude')}
                  </button>
                </FeedbackTarget>
                <FeedbackTarget align="right" message={tooltipFor(`${skill.id}:install:codex`)}>
                  <button
                    className="secondary-button"
                    disabled={busyAction !== null}
                    onClick={() => void installSkill(skill, 'codex')}
                    type="button"
                  >
                    <Download size={15} />
                    {t('skill.installCodex')}
                  </button>
                </FeedbackTarget>
              </div>
            </article>
          );
        })}
        {skills.length === 0 ? <div className="empty-state">{t('skill.empty')}</div> : null}
      </div>
    </section>
  );
}

function formatPlatform(platform: SkillPlatform): string {
  return platform === 'claude' ? 'Claude' : 'Codex';
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  return date.toLocaleDateString();
}
