import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  symlink,
  writeFile
} from 'node:fs/promises';
import type { Dirent } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, sep } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createTestDatabase } from '../desktop/main/services/database';
import {
  createSkillService,
  defaultSkillRoots
} from '../desktop/main/services/skillService';
import {
  nodeSkillFileSystem,
  type SkillFileSystem
} from '../desktop/main/services/skillFileSystem';
import { packageSkillContent } from '../desktop/main/services/skillOperations';
import { scanSkillRoot } from '../desktop/main/services/skillScanner';
import { writeZipFile } from '../desktop/main/services/zipWriter';

describe('skill service', () => {
  it('uses official user skill roots for Claude and Codex', () => {
    expect(defaultSkillRoots()).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          platform: 'claude',
          path: expect.stringContaining(join('.claude', 'skills'))
        }),
        expect.objectContaining({
          platform: 'codex',
          path: expect.stringContaining(join('.agents', 'skills'))
        })
      ])
    );
  });

  it('always exposes exactly two bundled skills without creating platform roots', async () => {
    const root = await mkdtemp(join(tmpdir(), 'spellbook-bundled-'));
    const claudeRoot = join(root, 'missing-claude');
    const codexRoot = join(root, 'missing-codex');
    const service = createSkillService(await createTestDatabase(), {
      roots: [
        { platform: 'claude', path: claudeRoot },
        { platform: 'codex', path: codexRoot }
      ],
      packageDirectory: join(root, 'packages')
    });

    const library = await service.getLibraryState();

    expect(library.items).toHaveLength(2);
    expect(library.items.map((item) => item.id)).toEqual([
      'bundled:prompt-refiner',
      'bundled:task-planner'
    ]);
    expect(
      library.items.every(
        (item) =>
          item.files.includes('SKILL.md') &&
          item.installation.claude.state === 'missing' &&
          item.installation.codex.state === 'missing'
      )
    ).toBe(true);
    await expect(readdir(claudeRoot)).rejects.toMatchObject({ code: 'ENOENT' });
    await expect(readdir(codexRoot)).rejects.toMatchObject({ code: 'ENOENT' });
    await rm(root, { recursive: true, force: true });
  });

  it('scans both sources and returns a fresh composed library snapshot', async () => {
    const fixture = await createSkillFixture();
    const service = createSkillService(await createTestDatabase(), {
      roots: fixture.roots,
      packageDirectory: fixture.packageRoot
    });

    const result = await service.scanSkills();

    expect(result.outcome).toBe('success');
    expect(result.freshSkillCount).toBe(2);
    expect(result.sources).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          platform: 'claude',
          status: 'success',
          skillCount: 1
        }),
        expect.objectContaining({
          platform: 'codex',
          status: 'success',
          skillCount: 1
        })
      ])
    );
    expect(result.library.items).toHaveLength(4);
    expect(
      result.library.items.find((item) => item.name === 'codex-review')
    ).toMatchObject({
      source: 'local',
      discoveredPlatform: 'codex',
      fileCount: 2,
      packageable: true
    });
    await rm(fixture.root, { recursive: true, force: true });
  });

  it('refreshes a successful source while preserving the failed source cache as stale', async () => {
    const fixture = await createSkillFixture();
    const service = createSkillService(await createTestDatabase(), {
      roots: fixture.roots,
      packageDirectory: fixture.packageRoot
    });
    await service.scanSkills();
    await rm(fixture.claudeRoot, { recursive: true, force: true });
    await rm(fixture.codexRoot, { recursive: true, force: true });
    await writeFile(fixture.codexRoot, 'not a directory', 'utf8');

    const result = await service.scanSkills();
    const codexSource = result.sources.find((source) => source.platform === 'codex');

    expect(result.outcome).toBe('partial');
    expect(result.freshSkillCount).toBe(0);
    expect(result.sources).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          platform: 'claude',
          status: 'missing_directory',
          skillCount: 0
        }),
        expect.objectContaining({
          platform: 'codex',
          status: 'failed',
          cachedSkillCount: 1
        })
      ])
    );
    expect(codexSource).not.toHaveProperty('skillCount');
    expect(
      result.library.items.find((item) => item.name === 'codex-review')
    ).toMatchObject({ stale: true });
    expect(
      result.library.items.some((item) => item.name === 'claude-migrate')
    ).toBe(false);
    await rm(fixture.root, { recursive: true, force: true });
  });

  it('maps platform permission errors to unreadable without deleting cached skills', async () => {
    const fixture = await createSkillFixture();
    let denyCodex = false;
    const service = createSkillService(await createTestDatabase(), {
      roots: fixture.roots,
      packageDirectory: fixture.packageRoot,
      fs: {
        ...nodeSkillFileSystem,
        async lstat(path) {
          if (denyCodex && path === fixture.codexRoot) {
            throw Object.assign(new Error('permission denied'), {
              code: 'EACCES',
              path
            });
          }
          return nodeSkillFileSystem.lstat(path);
        }
      }
    });
    await service.scanSkills();
    denyCodex = true;

    const result = await service.scanSkills();

    expect(result.outcome).toBe('partial');
    expect(result.sources).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          platform: 'codex',
          status: 'unreadable',
          cachedSkillCount: 1,
          error: expect.objectContaining({ code: 'permission_denied' })
        })
      ])
    );
    expect(
      result.library.items.find((item) => item.name === 'codex-review')
    ).toMatchObject({ stale: true });
    await rm(fixture.root, { recursive: true, force: true });
  });

  it('clears authoritative missing sources while keeping bundled skills', async () => {
    const fixture = await createSkillFixture();
    const service = createSkillService(await createTestDatabase(), {
      roots: fixture.roots,
      packageDirectory: fixture.packageRoot
    });
    await service.scanSkills();
    await rm(fixture.claudeRoot, { recursive: true, force: true });
    await rm(fixture.codexRoot, { recursive: true, force: true });

    const result = await service.scanSkills();

    expect(result.outcome).toBe('success');
    expect(result.freshSkillCount).toBe(0);
    expect(result.library.items).toHaveLength(2);
    expect(result.library.items.every((item) => item.source === 'bundled')).toBe(true);
    await rm(fixture.root, { recursive: true, force: true });
  });

  it('reports total failure and retains both source snapshots as stale', async () => {
    const fixture = await createSkillFixture();
    const service = createSkillService(await createTestDatabase(), {
      roots: fixture.roots,
      packageDirectory: fixture.packageRoot
    });
    await service.scanSkills();
    await rm(fixture.claudeRoot, { recursive: true, force: true });
    await rm(fixture.codexRoot, { recursive: true, force: true });
    await writeFile(fixture.claudeRoot, 'not a directory', 'utf8');
    await writeFile(fixture.codexRoot, 'not a directory', 'utf8');

    const result = await service.scanSkills();

    expect(result.outcome).toBe('failed');
    expect(result.freshSkillCount).toBe(0);
    expect(result.sources).toEqual([
      expect.objectContaining({
        platform: 'claude',
        status: 'failed',
        cachedSkillCount: 1
      }),
      expect.objectContaining({
        platform: 'codex',
        status: 'failed',
        cachedSkillCount: 1
      })
    ]);
    expect(
      result.library.items.filter((item) => item.source === 'local')
    ).toEqual([
      expect.objectContaining({ stale: true }),
      expect.objectContaining({ stale: true })
    ]);
    await rm(fixture.root, { recursive: true, force: true });
  });

  it('installs atomically, updates only the selected platform, and never overwrites conflicts', async () => {
    const fixture = await createEmptyRoots();
    const service = createSkillService(await createTestDatabase(), {
      roots: fixture.roots,
      packageDirectory: fixture.packageRoot
    });

    const installed = await service.installSkill({
      skillId: 'bundled:prompt-refiner',
      platform: 'claude'
    });
    expect(installed.ok).toBe(true);
    if (!installed.ok) {
      throw new Error('Expected install success');
    }
    expect(installed.item.installation.claude.state).toBe('installed');
    expect(installed.item.installation.codex.state).toBe('missing');
    expect(await readFile(join(installed.targetPath, 'SKILL.md'), 'utf8')).toContain(
      '# Prompt Refiner'
    );

    await writeFile(join(installed.targetPath, 'SKILL.md'), 'existing user copy', 'utf8');
    const conflict = await service.installSkill({
      skillId: 'bundled:prompt-refiner',
      platform: 'claude'
    });
    expect(conflict).toMatchObject({
      ok: false,
      error: { code: 'target_conflict' }
    });
    expect(await readFile(join(installed.targetPath, 'SKILL.md'), 'utf8')).toBe(
      'existing user copy'
    );
    await rm(fixture.root, { recursive: true, force: true });
  });

  it('cleans staging when the atomic commit fails', async () => {
    const fixture = await createEmptyRoots();
    const service = createSkillService(await createTestDatabase(), {
      roots: fixture.roots,
      packageDirectory: fixture.packageRoot,
      fs: {
        ...nodeSkillFileSystem,
        async rename(oldPath, newPath) {
          if (newPath.endsWith('task-planner')) {
            throw Object.assign(new Error('commit failed'), {
              code: 'EIO',
              path: newPath
            });
          }
          return nodeSkillFileSystem.rename(oldPath, newPath);
        }
      }
    });

    const result = await service.installSkill({
      skillId: 'bundled:task-planner',
      platform: 'codex'
    });

    expect(result).toMatchObject({ ok: false, error: { code: 'commit_failed' } });
    expect(await readdir(fixture.codexRoot)).toEqual([]);
    await expect(readdir(join(fixture.codexRoot, 'task-planner'))).rejects.toMatchObject({
      code: 'ENOENT'
    });
    await rm(fixture.root, { recursive: true, force: true });
  });

  it('preserves a concurrently created target and reports a conflict', async () => {
    const fixture = await createEmptyRoots();
    const targetPath = join(fixture.codexRoot, 'task-planner');
    const markerPath = join(targetPath, 'owner-marker.txt');
    let injected = false;
    const service = createSkillService(await createTestDatabase(), {
      roots: fixture.roots,
      packageDirectory: fixture.packageRoot,
      fs: {
        ...nodeSkillFileSystem,
        async mkdir(path, options) {
          if (path === targetPath && !injected) {
            injected = true;
            await nodeSkillFileSystem.mkdir(path);
            await nodeSkillFileSystem.writeFile(markerPath, Buffer.from('keep me'));
          }
          return nodeSkillFileSystem.mkdir(path, options);
        }
      }
    });

    const result = await service.installSkill({
      skillId: 'bundled:task-planner',
      platform: 'codex'
    });

    expect(result).toMatchObject({ ok: false, error: { code: 'target_conflict' } });
    expect(await readFile(markerPath, 'utf8')).toBe('keep me');
    expect(await readdir(fixture.codexRoot)).toEqual(['task-planner']);
    await rm(fixture.root, { recursive: true, force: true });
  });

  it('rejects a linked target root and a linked parent, including Windows junctions', async () => {
    const fixture = await createEmptyRoots();
    const actualRoot = join(fixture.root, 'actual-target');
    const linkedRoot = join(fixture.root, 'linked-target');
    await mkdir(actualRoot, { recursive: true });
    await symlink(actualRoot, linkedRoot, process.platform === 'win32' ? 'junction' : 'dir');
    const linkedRootService = createSkillService(await createTestDatabase(), {
      roots: [
        { platform: 'claude', path: fixture.claudeRoot },
        { platform: 'codex', path: linkedRoot }
      ],
      packageDirectory: fixture.packageRoot
    });

    await expect(
      linkedRootService.installSkill({
        skillId: 'bundled:prompt-refiner',
        platform: 'codex'
      })
    ).resolves.toMatchObject({ ok: false, error: { code: 'unsupported_entry' } });
    await expect(readdir(join(actualRoot, 'prompt-refiner'))).rejects.toMatchObject({
      code: 'ENOENT'
    });

    const actualParent = join(fixture.root, 'actual-parent');
    const linkedParent = join(fixture.root, 'linked-parent');
    await mkdir(join(actualParent, 'skills'), { recursive: true });
    await symlink(
      actualParent,
      linkedParent,
      process.platform === 'win32' ? 'junction' : 'dir'
    );
    const linkedParentService = createSkillService(await createTestDatabase(), {
      roots: [
        { platform: 'claude', path: fixture.claudeRoot },
        { platform: 'codex', path: join(linkedParent, 'skills') }
      ],
      packageDirectory: fixture.packageRoot
    });

    await expect(
      linkedParentService.installSkill({
        skillId: 'bundled:task-planner',
        platform: 'codex'
      })
    ).resolves.toMatchObject({ ok: false, error: { code: 'unsupported_entry' } });
    await expect(readdir(join(actualParent, 'skills', 'task-planner'))).rejects.toMatchObject({
      code: 'ENOENT'
    });
    await rm(fixture.root, { recursive: true, force: true });
  });

  it('installs to a clean platform when the other platform target is a junction conflict', async () => {
    const fixture = await createEmptyRoots();
    const junctionTarget = join(fixture.root, 'external-task-planner');
    const markerPath = join(junctionTarget, 'owner-marker.txt');
    await mkdir(junctionTarget, { recursive: true });
    await writeFile(markerPath, 'keep me', 'utf8');
    await symlink(
      junctionTarget,
      join(fixture.claudeRoot, 'task-planner'),
      process.platform === 'win32' ? 'junction' : 'dir'
    );
    const maxCodexPathLength = Math.max(
      join(fixture.codexRoot, 'task-planner', 'SKILL.md').length,
      join(fixture.codexRoot, 'task-planner', 'references', 'example.md').length
    );
    const service = createSkillService(await createTestDatabase(), {
      roots: fixture.roots,
      packageDirectory: fixture.packageRoot,
      fs: createPathLengthLimitedFileSystem(
        fixture.codexRoot,
        maxCodexPathLength
      )
    });

    const result = await service.installSkill({
      skillId: 'bundled:task-planner',
      platform: 'codex'
    });

    expect(result).toMatchObject({
      ok: true,
      platform: 'codex',
      item: {
        installation: {
          claude: { state: 'conflict' },
          codex: { state: 'installed' }
        }
      }
    });
    expect(await readFile(markerPath, 'utf8')).toBe('keep me');
    expect(await readFile(join(fixture.codexRoot, 'task-planner', 'SKILL.md'), 'utf8'))
      .toContain('# Task Planner');
    await rm(fixture.root, { recursive: true, force: true });
  });

  it('rejects unsafe scan directory names and zip traversal before writing output', async () => {
    const fixture = await createEmptyRoots();
    const unsafeDirent = {
      name: '..\\outside',
      isDirectory: () => true,
      isFile: () => false,
      isSymbolicLink: () => false
    } as Dirent;
    const scanResult = await scanSkillRoot(
      { platform: 'codex', path: fixture.codexRoot },
      {
        ...nodeSkillFileSystem,
        async readdir(path) {
          return path === fixture.codexRoot
            ? [unsafeDirent]
            : nodeSkillFileSystem.readdir(path);
        }
      }
    );
    expect(scanResult).toMatchObject({
      status: 'failed',
      error: { code: 'unsupported_entry' }
    });

    const packageResult = await packageSkillContent({
      source: {
        id: 'malicious',
        directoryName: '..\\outside',
        files: ['SKILL.md'],
        readFile: async () => Buffer.from('# malicious')
      },
      packageDirectory: fixture.packageRoot,
      fs: nodeSkillFileSystem
    });
    expect(packageResult).toMatchObject({ ok: false, error: { code: 'invalid_request' } });
    await expect(readdir(fixture.packageRoot)).rejects.toMatchObject({ code: 'ENOENT' });

    const zipPath = join(fixture.root, 'unsafe.zip');
    await expect(
      writeZipFile(zipPath, [
        { name: '../outside/SKILL.md', data: Buffer.from('# malicious') }
      ])
    ).rejects.toMatchObject({ code: 'EINVAL' });
    await expect(readFile(zipPath)).rejects.toMatchObject({ code: 'ENOENT' });
    await rm(fixture.root, { recursive: true, force: true });
  });

  it('keeps independent operations locked until the owning promise settles', async () => {
    const fixture = await createEmptyRoots();
    let release!: () => void;
    let entered!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const enteredGate = new Promise<void>((resolve) => {
      entered = resolve;
    });
    let held = false;
    const service = createSkillService(await createTestDatabase(), {
      roots: fixture.roots,
      packageDirectory: fixture.packageRoot,
      fs: {
        ...nodeSkillFileSystem,
        async mkdir(path, options) {
          if (path === fixture.codexRoot && options?.recursive && !held) {
            held = true;
            entered();
            await gate;
          }
          return nodeSkillFileSystem.mkdir(path, options);
        }
      }
    });

    const first = service.installSkill({
      skillId: 'bundled:prompt-refiner',
      platform: 'codex'
    });
    await enteredGate;
    await expect(
      service.packageSkill({ skillId: 'bundled:prompt-refiner' })
    ).resolves.toMatchObject({
      ok: false,
      error: { code: 'operation_in_progress' }
    });
    release();
    await expect(first).resolves.toMatchObject({ ok: true });
    await rm(fixture.root, { recursive: true, force: true });
  });

  it('packages bundled content through a temporary zip and preserves relative paths', async () => {
    const fixture = await createEmptyRoots();
    const service = createSkillService(await createTestDatabase(), {
      roots: fixture.roots,
      packageDirectory: fixture.packageRoot
    });

    const result = await service.packageSkill({
      skillId: 'bundled:task-planner'
    });
    expect(result.ok).toBe(true);
    if (!result.ok) {
      throw new Error('Expected package success');
    }
    const zipText = (await readFile(result.outputPath)).toString('latin1');
    expect(zipText).toContain('task-planner/SKILL.md');
    expect(zipText).toContain('task-planner/references/example.md');
    expect((await readdir(fixture.packageRoot)).some((file) => file.endsWith('.tmp'))).toBe(
      false
    );
    await rm(fixture.root, { recursive: true, force: true });
  });

  it('keeps the full file list for a 1,000-file skill tree', async () => {
    const fixture = await createEmptyRoots();
    const largeRoot = join(fixture.codexRoot, 'large-skill');
    await mkdir(join(largeRoot, 'references'), { recursive: true });
    await writeFile(
      join(largeRoot, 'SKILL.md'),
      ['---', 'name: large-skill', 'description: Large fixture', '---'].join('\n'),
      'utf8'
    );
    await Promise.all(
      Array.from({ length: 1000 }, (_, index) =>
        writeFile(
          join(largeRoot, 'references', `file-${String(index).padStart(4, '0')}.md`),
          `fixture ${index}`,
          'utf8'
        )
      )
    );
    const service = createSkillService(await createTestDatabase(), {
      roots: fixture.roots,
      packageDirectory: fixture.packageRoot
    });

    const result = await service.scanSkills();
    const largeSkill = result.library.items.find((item) => item.name === 'large-skill');

    expect(largeSkill?.fileCount).toBe(1001);
    expect(largeSkill?.files).toHaveLength(1001);
    expect(largeSkill?.files.at(-1)).toBe('SKILL.md');
    await rm(fixture.root, { recursive: true, force: true });
  });

  it('installs a 1,001-file skill with deep paths without lengthening final paths', async () => {
    const fixture = await createEmptyRoots();
    const directoryName = 'beta-long';
    const firstSegment = `references-${'a'.repeat(70)}`;
    const secondSegment = `nested-${'b'.repeat(70)}`;
    const sourceRoot = join(fixture.codexRoot, directoryName);
    const deepSourceRoot = join(sourceRoot, firstSegment, secondSegment);
    await mkdir(deepSourceRoot, { recursive: true });
    await writeFile(
      join(sourceRoot, 'SKILL.md'),
      ['---', 'name: Beta Long', 'description: Long path fixture', '---'].join('\n'),
      'utf8'
    );
    const fileNames = Array.from(
      { length: 1000 },
      (_, index) => `qa-file-${String(index + 1).padStart(4, '0')}-${'c'.repeat(48)}.md`
    );
    await Promise.all(
      fileNames.map((fileName, index) =>
        writeFile(join(deepSourceRoot, fileName), `fixture ${index}`, 'utf8')
      )
    );
    const deepestFinalPath = join(
      fixture.claudeRoot,
      directoryName,
      firstSegment,
      secondSegment,
      fileNames.at(-1)!
    );
    const service = createSkillService(await createTestDatabase(), {
      roots: fixture.roots,
      packageDirectory: fixture.packageRoot,
      fs: createPathLengthLimitedFileSystem(
        fixture.claudeRoot,
        deepestFinalPath.length
      )
    });
    const scan = await service.scanSkills();
    const localSkill = scan.library.items.find((item) => item.name === 'Beta Long');
    expect(localSkill).toMatchObject({ source: 'local', fileCount: 1001 });

    const result = await service.installSkill({
      skillId: localSkill!.id,
      platform: 'claude'
    });

    expect(result).toMatchObject({
      ok: true,
      platform: 'claude',
      item: { installation: { claude: { state: 'installed' } } }
    });
    expect(
      await readFile(
        join(
          fixture.claudeRoot,
          directoryName,
          firstSegment,
          secondSegment,
          fileNames.at(-1)!
        ),
        'utf8'
      )
    ).toBe('fixture 999');
    expect((await readdir(join(fixture.claudeRoot, directoryName))).sort()).toEqual(
      ['SKILL.md', firstSegment].sort()
    );
    await rm(fixture.root, { recursive: true, force: true });
  });
});

function createPathLengthLimitedFileSystem(
  targetRoot: string,
  maximumPathLength: number
): SkillFileSystem {
  return {
    ...nodeSkillFileSystem,
    async writeFile(path, data) {
      if (
        (path === targetRoot || path.startsWith(`${targetRoot}${sep}`)) &&
        path.length > maximumPathLength
      ) {
        throw Object.assign(new Error('path too long'), {
          code: 'ENAMETOOLONG',
          path
        });
      }
      return nodeSkillFileSystem.writeFile(path, data);
    }
  };
}

async function createSkillFixture() {
  const fixture = await createEmptyRoots();
  await mkdir(join(fixture.codexRoot, 'codex-review', 'scripts'), { recursive: true });
  await mkdir(join(fixture.claudeRoot, 'claude-migrate'), { recursive: true });
  await writeFile(
    join(fixture.codexRoot, 'codex-review', 'SKILL.md'),
    ['---', 'name: codex-review', 'description: Review Codex changes', '---', '', 'Use Codex.'].join('\n'),
    'utf8'
  );
  await writeFile(
    join(fixture.codexRoot, 'codex-review', 'scripts', 'run.ps1'),
    'Write-Output "run"\n',
    'utf8'
  );
  await writeFile(
    join(fixture.claudeRoot, 'claude-migrate', 'SKILL.md'),
    ['---', 'name: claude-migrate', 'description: Move local Claude skills', '---', '', 'Use Claude.'].join('\n'),
    'utf8'
  );
  return fixture;
}

async function createEmptyRoots() {
  const root = await mkdtemp(join(tmpdir(), 'spellbook-skills-'));
  const codexRoot = join(root, 'codex-skills');
  const claudeRoot = join(root, 'claude-skills');
  const packageRoot = join(root, 'packages');
  await mkdir(codexRoot, { recursive: true });
  await mkdir(claudeRoot, { recursive: true });
  return {
    root,
    codexRoot,
    claudeRoot,
    packageRoot,
    roots: [
      { platform: 'claude' as const, path: claudeRoot },
      { platform: 'codex' as const, path: codexRoot }
    ]
  };
}
