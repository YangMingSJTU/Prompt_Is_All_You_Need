import { ArrowUpDown, Check } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { TFunction } from '../i18n';
import { SPELL_SORT_OPTIONS, type SpellSortMode } from '../spellSort';

interface SpellSortMenuProps {
  value: SpellSortMode;
  onChange(value: SpellSortMode): void;
  t: TFunction;
  variant: 'button' | 'icon';
  className?: string;
}

export function SpellSortMenu({ value, onChange, t, variant, className }: SpellSortMenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const currentOption = SPELL_SORT_OPTIONS.find((option) => option.value === value) ?? SPELL_SORT_OPTIONS[0];
  const rootClassName = ['sort-menu-root', variant === 'icon' ? 'compact' : '', className ?? '']
    .filter(Boolean)
    .join(' ');

  useEffect(() => {
    if (!open) {
      return;
    }

    function handlePointerDown(event: PointerEvent): void {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent): void {
      if (event.key === 'Escape') {
        setOpen(false);
      }
    }

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

  function selectSortMode(nextValue: SpellSortMode): void {
    onChange(nextValue);
    setOpen(false);
  }

  return (
    <div className={rootClassName} ref={rootRef}>
      <button
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={t('floating.sort.label')}
        className="sort-menu-button"
        onClick={() => setOpen((current) => !current)}
        title={variant === 'icon' ? t(currentOption.labelKey) : t('floating.sort.label')}
        type="button"
      >
        <ArrowUpDown size={15} />
        {variant === 'button' ? <span>{t(currentOption.labelKey)}</span> : null}
      </button>
      {open ? (
        <div className="sort-menu-popover" role="menu">
          {SPELL_SORT_OPTIONS.map((option) => (
            <button
              aria-checked={value === option.value}
              className={value === option.value ? 'sort-menu-option selected' : 'sort-menu-option'}
              key={option.value}
              onClick={() => selectSortMode(option.value)}
              role="menuitemradio"
              type="button"
            >
              <span>{t(option.labelKey)}</span>
              {value === option.value ? <Check size={14} /> : null}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
