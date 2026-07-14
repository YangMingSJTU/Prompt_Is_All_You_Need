import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import type { TFunction } from '../i18n';
import type { SpellTableSortMode, SpellTableSortState } from '../spellSort';

interface SpellIdentityProps {
  name: string;
  tags: string[];
}

export function SpellIdentity({ name, tags }: SpellIdentityProps) {
  return (
    <div className="spell-identity">
      <span className="spell-identity-name" title={name}>
        {name}
      </span>
      {tags.length ? (
        <span className="spell-identity-tags">
          {tags.map((tag) => (
            <span className="spell-identity-tag" key={tag} title={tag}>
              {tag}
            </span>
          ))}
        </span>
      ) : null}
    </div>
  );
}

interface SpellListSortHeaderProps {
  className: string;
  hasLeadingCell?: boolean;
  onSort(mode: SpellTableSortMode): void;
  sortState: SpellTableSortState;
  t: TFunction;
}

export function SpellListSortHeader({
  className,
  hasLeadingCell = false,
  onSort,
  sortState,
  t
}: SpellListSortHeaderProps) {
  return (
    <div className={`spell-list-sort-header ${className}`}>
      {hasLeadingCell ? <span aria-hidden="true" className="spell-list-sort-placeholder" /> : null}
      <SpellSortHeaderButton
        label={t('spell.name')}
        mode="name"
        onSort={onSort}
        sortState={sortState}
      />
      <SpellSortHeaderButton
        label={t('spell.updatedAt')}
        mode="updated"
        onSort={onSort}
        sortState={sortState}
      />
      <SpellSortHeaderButton
        label={t('spell.usageCount')}
        mode="usage"
        onSort={onSort}
        sortState={sortState}
      />
      <span aria-hidden="true" className="spell-list-sort-placeholder" />
    </div>
  );
}

function SpellSortHeaderButton({
  label,
  mode,
  onSort,
  sortState
}: {
  label: string;
  mode: SpellTableSortMode;
  onSort(mode: SpellTableSortMode): void;
  sortState: SpellTableSortState;
}) {
  const active = sortState.mode === mode;
  const Icon = !active ? ArrowUpDown : sortState.direction === 'asc' ? ArrowUp : ArrowDown;

  return (
    <button
      aria-pressed={active}
      className={active ? `spell-sort-header ${mode} active` : `spell-sort-header ${mode}`}
      onClick={() => onSort(mode)}
      title={label}
      type="button"
    >
      <span>{label}</span>
      <Icon size={13} />
    </button>
  );
}
