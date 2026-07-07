import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createTestDatabase } from '../desktop/main/services/database';
import { createSkillService } from '../desktop/main/services/skillService';

describe('skill service', () => {
  it('scans Claude and Codex skill packages from local roots', async () => {
    const fixture = await createSkillFixture();
    const db = await createTestDatabase();
    const service = createSkillService(db, {
      roots: [
        { platform: 'codex', path: fixture.codexRoot },
        { platform: 'claude', path: fixture.claudeRoot }
      ],
      packageDirectory: fixture.packageRoot
    });

    const skills = await service.scanSkills();

    expect(skills).toHaveLength(2);
    expect(skills).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          platform: 'codex',
          name: 'codex-review',
          description: 'Review Codex changes',
          fileCount: 2,
          packageable: true
        }),
        expect.objectContaining({
          platform: 'claude',
          name: 'claude-migrate',
          description: 'Move local Claude skills',
          fileCount: 1,
          packageable: true
        })
      ])
    );

    expect(await service.listSkills()).toHaveLength(2);
    await rm(fixture.root, { recursive: true, force: true });
  });

  it('packages a skill as a zip that preserves relative file paths', async () => {
    const fixture = await createSkillFixture();
    const db = await createTestDatabase();
    const service = createSkillService(db, {
      roots: [{ platform: 'codex', path: fixture.codexRoot }],
      packageDirectory: fixture.packageRoot
    });
    const [skill] = await service.scanSkills();

    const result = await service.packageSkill(skill.id);
    const bytes = await readFile(result.path);
    const zipText = bytes.toString('latin1');

    expect(result.path.endsWith('.zip')).toBe(true);
    expect(zipText).toContain('codex-review/SKILL.md');
    expect(zipText).toContain('codex-review/scripts/run.ps1');
    await rm(fixture.root, { recursive: true, force: true });
  });

  it('installs a skill package without overwriting existing target packages', async () => {
    const fixture = await createSkillFixture();
    const db = await createTestDatabase();
    const service = createSkillService(db, {
      roots: [
        { platform: 'codex', path: fixture.codexRoot },
        { platform: 'claude', path: fixture.claudeRoot }
      ],
      packageDirectory: fixture.packageRoot
    });
    const skills = await service.scanSkills();
    const skill = skills.find((item) => item.platform === 'codex');
    expect(skill).toBeDefined();

    const firstInstall = await service.installSkill(skill!.id, 'claude');
    const installedScript = await readFile(join(firstInstall.path, 'scripts', 'run.ps1'), 'utf8');
    await writeFile(join(firstInstall.path, 'SKILL.md'), 'existing user copy', 'utf8');

    const conflict = await service.installSkill(skill!.id, 'claude');
    const preserved = await readFile(join(firstInstall.path, 'SKILL.md'), 'utf8');

    expect(installedScript).toBe('Write-Output "run"\n');
    expect(conflict.warning).toContain('already exists');
    expect(preserved).toBe('existing user copy');
    await rm(fixture.root, { recursive: true, force: true });
  });
});

async function createSkillFixture() {
  const root = await mkdtemp(join(tmpdir(), 'apm-skills-'));
  const codexRoot = join(root, 'codex-skills');
  const claudeRoot = join(root, 'claude-skills');
  const packageRoot = join(root, 'packages');
  await mkdir(join(codexRoot, 'codex-review', 'scripts'), { recursive: true });
  await mkdir(join(claudeRoot, 'claude-migrate'), { recursive: true });
  await writeFile(
    join(codexRoot, 'codex-review', 'SKILL.md'),
    ['---', 'name: codex-review', 'description: Review Codex changes', '---', '', 'Use Codex.'].join('\n'),
    'utf8'
  );
  await writeFile(join(codexRoot, 'codex-review', 'scripts', 'run.ps1'), 'Write-Output "run"\n', 'utf8');
  await writeFile(
    join(claudeRoot, 'claude-migrate', 'SKILL.md'),
    ['---', 'name: claude-migrate', 'description: Move local Claude skills', '---', '', 'Use Claude.'].join('\n'),
    'utf8'
  );
  return { root, codexRoot, claudeRoot, packageRoot };
}
