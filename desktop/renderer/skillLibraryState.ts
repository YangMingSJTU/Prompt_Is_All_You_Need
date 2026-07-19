import type {
  SkillLibraryItem,
  SkillOperationError,
  SkillPlatform,
  SkillSource
} from '../shared/skillTypes';

export type SkillSourceFilter = 'all' | SkillSource;
export type SkillPlatformFilter = 'all' | SkillPlatform;

export interface SkillLibraryFilters {
  query: string;
  source: SkillSourceFilter;
  platform: SkillPlatformFilter;
}

export type SkillActionErrors = Record<string, SkillOperationError | undefined>;
export type SkillBusyStateUpdater = (
  updater: (current: Set<string>) => Set<string>
) => void;

export function addBusyAction(current: Set<string>, actionKey: string): Set<string> {
  const next = new Set(current);
  next.add(actionKey);
  return next;
}

export function removeBusyAction(current: Set<string>, actionKey: string): Set<string> {
  const next = new Set(current);
  next.delete(actionKey);
  return next;
}

export async function runTrackedSkillAction<T>(
  actionKey: string,
  updateBusy: SkillBusyStateUpdater,
  operation: () => Promise<T>
): Promise<T> {
  updateBusy((current) => addBusyAction(current, actionKey));
  try {
    return await operation();
  } finally {
    updateBusy((current) => removeBusyAction(current, actionKey));
  }
}

export function clearSkillActionError(
  current: SkillActionErrors,
  actionKey: string
): SkillActionErrors {
  if (!(actionKey in current)) {
    return current;
  }
  const next = { ...current };
  delete next[actionKey];
  return next;
}

export function pruneSkillActionErrors(
  current: SkillActionErrors,
  skillIds: string[]
): SkillActionErrors {
  const entries = Object.entries(current).filter(([actionKey]) =>
    skillIds.some((skillId) => actionKey.startsWith(`${skillId}:`))
  );
  return entries.length === Object.keys(current).length
    ? current
    : Object.fromEntries(entries);
}

export function filterSkillItems(
  items: SkillLibraryItem[],
  filters: SkillLibraryFilters
): SkillLibraryItem[] {
  const query = filters.query.trim().toLocaleLowerCase();
  return items.filter((item) => {
    if (filters.source !== 'all' && item.source !== filters.source) {
      return false;
    }
    if (filters.platform !== 'all') {
      if (
        item.source === 'local' &&
        item.discoveredPlatform !== filters.platform
      ) {
        return false;
      }
      if (
        item.source === 'bundled' &&
        !item.compatiblePlatforms.includes(filters.platform)
      ) {
        return false;
      }
    }
    return (
      !query ||
      item.name.toLocaleLowerCase().includes(query) ||
      item.description.toLocaleLowerCase().includes(query)
    );
  });
}

export function selectVisibleSkillId(
  currentId: string | null,
  visibleItems: SkillLibraryItem[]
): string | null {
  if (currentId && visibleItems.some((item) => item.id === currentId)) {
    return currentId;
  }
  return visibleItems[0]?.id ?? null;
}
