import { Check, Funnel, FunnelX, Search } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import type { I18nKey, TFunction } from '../i18n';
import type { SkillPlatformFilter, SkillSourceFilter } from '../skillLibraryState';

interface SkillSearchFilterProps {
  platform: SkillPlatformFilter;
  query: string;
  source: SkillSourceFilter;
  onClear(): void;
  onPlatformChange(value: SkillPlatformFilter): void;
  onQueryChange(value: string): void;
  onSourceChange(value: SkillSourceFilter): void;
  t: TFunction;
}

const SOURCE_OPTIONS: Array<{ value: SkillSourceFilter; labelKey: I18nKey }> = [
  { value: 'all', labelKey: 'skill.filter.source.all' },
  { value: 'bundled', labelKey: 'skill.filter.source.bundled' },
  { value: 'local', labelKey: 'skill.filter.source.local' }
];

const PLATFORM_OPTIONS: Array<{ value: SkillPlatformFilter; label: string; labelKey?: I18nKey }> = [
  { value: 'all', label: '', labelKey: 'skill.filter.platform.all' },
  { value: 'claude', label: 'Claude' },
  { value: 'codex', label: 'Codex' }
];

export function SkillSearchFilter({
  platform,
  query,
  source,
  onClear,
  onPlatformChange,
  onQueryChange,
  onSourceChange,
  t
}: SkillSearchFilterProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const popoverId = useId();
  const hasActiveFilters = source !== 'all' || platform !== 'all';

  useEffect(() => {
    if (!open) {
      return undefined;
    }
    function closeOnOutsidePointer(event: PointerEvent): void {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    function closeOnEscape(event: KeyboardEvent): void {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    }
    document.addEventListener('pointerdown', closeOnOutsidePointer);
    document.addEventListener('keydown', closeOnEscape);
    window.addEventListener('blur', closeOnBlur);
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsidePointer);
      document.removeEventListener('keydown', closeOnEscape);
      window.removeEventListener('blur', closeOnBlur);
    };
  }, [open]);

  function closeOnBlur(): void {
    setOpen(false);
  }

  return (
    <div className="spell-search-filter skill-search-filter" ref={rootRef}>
      <label className="search-box">
        <Search aria-hidden size={15} />
        <span className="sr-only">{t('skill.search.placeholder')}</span>
        <input
          onChange={(event) => onQueryChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              onQueryChange('');
            }
          }}
          placeholder={t('skill.search.placeholder')}
          value={query}
        />
      </label>
      <div className="spell-filter-menu-root">
        <button
          aria-controls={popoverId}
          aria-expanded={open}
          aria-haspopup="dialog"
          aria-label={t('skill.filter.label')}
          className={hasActiveFilters ? 'spell-filter-button active' : 'spell-filter-button'}
          onClick={() => setOpen((current) => !current)}
          title={t('skill.filter.label')}
          type="button"
        >
          <Funnel aria-hidden size={16} />
        </button>
        {open ? (
          <div
            aria-label={t('skill.filter.label')}
            className="spell-filter-popover skill-filter-popover"
            id={popoverId}
            role="dialog"
          >
            <FilterRadioGroup
              label={t('skill.filter.source')}
              onChange={onSourceChange}
              options={SOURCE_OPTIONS.map((option) => ({
                label: t(option.labelKey),
                value: option.value
              }))}
              value={source}
            />
            <FilterRadioGroup
              label={t('skill.filter.platform')}
              onChange={onPlatformChange}
              options={PLATFORM_OPTIONS.map((option) => ({
                label: option.labelKey ? t(option.labelKey) : option.label,
                value: option.value
              }))}
              value={platform}
            />
            <div className="spell-filter-footer">
              <button disabled={!hasActiveFilters} onClick={onClear} type="button">
                <FunnelX aria-hidden size={14} />
                <span>{t('skill.filter.clearAll')}</span>
              </button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function FilterRadioGroup<T extends string>({
  label,
  onChange,
  options,
  value
}: {
  label: string;
  onChange(value: T): void;
  options: Array<{ label: string; value: T }>;
  value: T;
}) {
  return (
    <section className="spell-filter-section">
      <div className="spell-filter-heading">{label}</div>
      <div aria-label={label} className="spell-filter-scope-options" role="radiogroup">
        {options.map((option) => (
          <button
            aria-checked={value === option.value}
            className={
              value === option.value
                ? 'spell-filter-scope-option selected'
                : 'spell-filter-scope-option'
            }
            key={option.value}
            onClick={() => onChange(option.value)}
            role="radio"
            type="button"
          >
            <span>{option.label}</span>
            {value === option.value ? <Check aria-hidden size={14} /> : null}
          </button>
        ))}
      </div>
    </section>
  );
}
