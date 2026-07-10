import { ArrowUpDown, Check } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import type { TFunction } from '../i18n';
import {
  DEFAULT_SORT_DIRECTIONS,
  SPELL_SORT_OPTIONS,
  type SpellSortDirection,
  type SpellSortMode
} from '../spellSort';

interface SpellSortMenuProps {
  value: SpellSortMode;
  direction: SpellSortDirection;
  onChange(value: SpellSortMode): void;
  onDirectionChange(value: SpellSortDirection): void;
  t: TFunction;
  variant: 'button' | 'icon';
  className?: string;
}

export function SpellSortMenu({
  value,
  direction,
  onChange,
  onDirectionChange,
  t,
  variant,
  className
}: SpellSortMenuProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const currentOption = SPELL_SORT_OPTIONS.find((option) => option.value === value) ?? SPELL_SORT_OPTIONS[0];
  const directionLabel = direction === 'asc' ? t('floating.sort.direction.asc') : t('floating.sort.direction.desc');
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
    onDirectionChange(DEFAULT_SORT_DIRECTIONS[nextValue]);
  }

  function selectDirection(nextDirection: SpellSortDirection): void {
    onDirectionChange(nextDirection);
  }

  return (
    <div className={rootClassName} ref={rootRef}>
      <button
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label={t('floating.sort.label')}
        className="sort-menu-button"
        onClick={() => setOpen((current) => !current)}
        title={
          variant === 'icon'
            ? `${t(currentOption.labelKey)} · ${directionLabel}`
            : t('floating.sort.label')
        }
        type="button"
      >
        <ArrowUpDown size={15} />
        {variant === 'button' ? (
          <span>
            {t(currentOption.labelKey)}
            <small>{directionLabel}</small>
          </span>
        ) : null}
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
          <div className="sort-direction-group" aria-label={t('floating.sort.direction')} role="group">
            <button
              aria-pressed={direction === 'asc'}
              className={direction === 'asc' ? 'sort-direction-button selected' : 'sort-direction-button'}
              onClick={() => selectDirection('asc')}
              type="button"
            >
              {t('floating.sort.direction.asc')}
            </button>
            <button
              aria-pressed={direction === 'desc'}
              className={direction === 'desc' ? 'sort-direction-button selected' : 'sort-direction-button'}
              onClick={() => selectDirection('desc')}
              type="button"
            >
              {t('floating.sort.direction.desc')}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
