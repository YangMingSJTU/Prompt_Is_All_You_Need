import { readFileSync } from 'node:fs';
import type { IpcMain } from 'electron';
import { describe, expect, it } from 'vitest';
import { registerSkillHandlers } from '../desktop/main/ipc/skillHandlers';
import type { SkillService } from '../desktop/main/services/skillService';
import type { SkillLibraryItem } from '../desktop/shared/skillTypes';
import {
  clearSkillActionError,
  filterSkillItems,
  pruneSkillActionErrors,
  runTrackedSkillAction,
  selectVisibleSkillId
} from '../desktop/renderer/skillLibraryState';
import {
  isPortableRelativePath,
  isSafeDirectoryName,
  resolveDirectoryInside,
  resolveInside
} from '../desktop/main/services/skillPath';

const missing = {
  state: 'missing' as const,
  targetPath: 'target'
};

const items: SkillLibraryItem[] = [
  {
    id: 'bundled:prompt-refiner',
    source: 'bundled',
    directoryName: 'prompt-refiner',
    name: 'Prompt Refiner',
    description: 'Clarify vague requests',
    compatiblePlatforms: ['claude', 'codex'],
    entryFilePath: 'SKILL.md',
    files: ['SKILL.md'],
    fileCount: 1,
    packageable: true,
    installation: { claude: missing, codex: missing }
  },
  {
    id: 'local:review',
    source: 'local',
    directoryName: 'review',
    name: 'Code Review',
    description: 'Review changed files',
    compatiblePlatforms: ['claude', 'codex'],
    discoveredPlatform: 'codex',
    rootPath: 'C:\\skills\\review',
    entryFilePath: 'C:\\skills\\review\\SKILL.md',
    files: ['SKILL.md'],
    fileCount: 1,
    packageable: true,
    installation: { claude: missing, codex: missing }
  }
];

describe('skill library renderer state', () => {
  it('combines case-insensitive name/description search with source and platform filters', () => {
    expect(
      filterSkillItems(items, {
        query: 'VAGUE',
        source: 'bundled',
        platform: 'claude'
      }).map((item) => item.id)
    ).toEqual(['bundled:prompt-refiner']);

    expect(
      filterSkillItems(items, {
        query: 'review',
        source: 'local',
        platform: 'claude'
      })
    ).toEqual([]);

    expect(
      filterSkillItems(items, {
        query: 'changed',
        source: 'local',
        platform: 'codex'
      }).map((item) => item.id)
    ).toEqual(['local:review']);
  });

  it('preserves a visible selection and falls back when it disappears', () => {
    expect(selectVisibleSkillId('local:review', items)).toBe('local:review');
    expect(selectVisibleSkillId('missing', items)).toBe('bundled:prompt-refiner');
    expect(selectVisibleSkillId('missing', [])).toBeNull();
  });

  it('tracks two interleaved promises without letting the first completion clear the second', async () => {
    const first = deferred<void>();
    const second = deferred<void>();
    let busyActions = new Set<string>();
    const updateBusy = (updater: (current: Set<string>) => Set<string>) => {
      busyActions = updater(busyActions);
    };
    const firstRun = runTrackedSkillAction('first:install:claude', updateBusy, () =>
      first.promise
    );
    const secondRun = runTrackedSkillAction('second:package', updateBusy, () =>
      second.promise
    );
    expect([...busyActions]).toEqual(['first:install:claude', 'second:package']);

    first.resolve();
    await firstRun;
    expect([...busyActions]).toEqual(['second:package']);

    second.resolve();
    await secondRun;
    expect([...busyActions]).toEqual([]);
  });

  it('persists keyed errors across selection changes and clears only retrying or removed skills', () => {
    const firstKey = 'bundled:first:install:claude';
    const secondKey = 'bundled:second:package';
    const errors = {
      [firstKey]: { code: 'copy_failed' as const, retryable: true },
      [secondKey]: { code: 'write_failed' as const, retryable: true }
    };

    expect(pruneSkillActionErrors(errors, ['bundled:first', 'bundled:second'])).toBe(errors);
    expect(clearSkillActionError(errors, secondKey)).toEqual({
      [firstKey]: errors[firstKey]
    });
    expect(pruneSkillActionErrors(errors, ['bundled:second'])).toEqual({
      [secondKey]: errors[secondKey]
    });
  });
});

describe('skill path safety', () => {
  it('accepts portable files and rejects traversal, absolute paths, and unsafe directory names', () => {
    expect(isPortableRelativePath('references/example.md')).toBe(true);
    expect(isPortableRelativePath('../outside.md')).toBe(false);
    expect(isPortableRelativePath('references\\example.md')).toBe(false);
    expect(isSafeDirectoryName('prompt-refiner')).toBe(true);
    expect(isSafeDirectoryName('../prompt-refiner')).toBe(false);
    expect(isSafeDirectoryName('nested/prompt-refiner')).toBe(false);
    expect(resolveInside('C:\\root', '../outside.md')).toBeNull();
    expect(resolveDirectoryInside('C:\\root', '..')).toBeNull();
  });
});

describe('skill library IPC and UI structure', () => {
  it('rejects dynamic IPC payload extras before calling the service', async () => {
    type Handler = (event: unknown, request?: unknown) => unknown;
    const handlers = new Map<string, Handler>();
    let installCalls = 0;
    let packageCalls = 0;
    const service: SkillService = {
      getLibraryState: async () => ({ items: [], sources: [] }),
      scanSkills: async () => ({
        outcome: 'success',
        freshSkillCount: 0,
        sources: [],
        library: { items: [], sources: [] }
      }),
      installSkill: async (request) => {
        installCalls += 1;
        return {
          ok: false,
          skillId: request.skillId,
          platform: request.platform,
          error: { code: 'skill_not_found', retryable: false }
        };
      },
      packageSkill: async (request) => {
        packageCalls += 1;
        return {
          ok: false,
          skillId: request.skillId,
          error: { code: 'skill_not_found', retryable: false }
        };
      }
    };
    registerSkillHandlers(
      {
        handle(channel: string, listener: (...args: unknown[]) => unknown) {
          handlers.set(channel, listener as unknown as Handler);
        }
      } as unknown as IpcMain,
      service
    );

    await expect(
      handlers.get('skills:install')?.(undefined, {
        skillId: 'bundled:prompt-refiner',
        platform: 'codex',
        targetPath: 'C:\\outside'
      })
    ).resolves.toMatchObject({ ok: false, error: { code: 'invalid_request' } });
    await expect(
      handlers.get('skills:package')?.(undefined, {
        skillId: 'bundled:prompt-refiner',
        overwrite: true
      })
    ).resolves.toMatchObject({ ok: false, error: { code: 'invalid_request' } });
    expect(installCalls).toBe(0);
    expect(packageCalls).toBe(0);
  });

  it('exposes only four narrow skill operations and rejects renderer paths and overwrite flags', () => {
    const handlers = readFileSync('desktop/main/ipc/skillHandlers.ts', 'utf8');
    const preload = readFileSync('desktop/main/preload.ts', 'utf8');
    const main = readFileSync('desktop/main/index.ts', 'utf8');

    expect(handlers).toContain("'skills:getLibraryState'");
    expect(handlers).toContain("'skills:scan'");
    expect(handlers).toContain("'skills:install'");
    expect(handlers).toContain("'skills:package'");
    expect(handlers).not.toContain('sourcePath');
    expect(handlers).not.toContain('targetPath');
    expect(handlers).not.toContain('overwrite');
    expect(preload).not.toContain("'skills:list'");
    expect(preload).toContain('InstallSkillRequest');
    expect(preload).toContain('PackageSkillRequest');
    expect(main).toContain('registerSkillHandlers(ipcMain, skillService)');
    expect(main).not.toContain("scanRequest.target === 'skills'");
  });

  it('uses an accessible master-detail view with independent installation rows and complete files', () => {
    const component = readFileSync(
      'desktop/renderer/components/SkillLibraryView.tsx',
      'utf8'
    );
    const app = readFileSync('desktop/renderer/App.tsx', 'utf8');
    const styles = readFileSync('desktop/renderer/styles.css', 'utf8');

    expect(component).toContain('className="skill-workspace"');
    expect(component).toContain('className="skill-master-list"');
    expect(component).toContain('className="skill-detail-pane"');
    expect(component).toContain('role="listbox"');
    expect(component).toContain('role="option"');
    expect(component).toContain('aria-selected={selected}');
    expect(component).toContain('aria-busy={scanning}');
    expect(component).toContain("(['claude', 'codex'] as const).map");
    expect(component).toContain('role="tree"');
    expect(component).toContain('files.slice(start, end)');
    expect(component).toContain('useFeedbackToast');
    expect(component).toContain('statusRef.current?.focus()');
    expect(component).toContain('aria-busy={hasBusyAction(busyActions, item.id)}');
    expect(component).not.toContain('Download');
    expect(app).toContain('<SkillLibraryView t={t} />');
    expect(app).not.toContain('window.spellbook.listSkills()');
    expect(styles).toContain('.skill-list-row:focus-visible');
    expect(styles).toContain('@media (prefers-reduced-motion: reduce)');
  });
});

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}
