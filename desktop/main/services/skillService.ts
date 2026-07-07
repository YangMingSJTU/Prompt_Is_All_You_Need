import { createHash } from 'node:crypto';
import { access, cp, mkdir, readFile, readdir, stat } from 'node:fs/promises';
import { homedir } from 'node:os';
import { basename, join, relative } from 'node:path';
import type { SkillPlatform, SkillRecord } from '../../shared/types';
import type { AppDatabase } from './database';
import { writeZipFile } from './zipWriter';

export interface SkillRoot {
  platform: SkillPlatform;
  path: string;
}

interface SkillServiceOptions {
  roots?: SkillRoot[];
  packageDirectory?: string;
}

interface SkillRow extends Record<string, unknown> {
  id: string;
  platform: string;
  name: string;
  description: string;
  root_path: string;
  entry_file_path: string;
  file_count: number;
  files: string;
  updated_at: string;
  packageable: number;
  install_state: string;
}

interface SkillManifest {
  name: string | null;
  description: string | null;
}

export function defaultSkillRoots(): SkillRoot[] {
  const home = homedir();
  return [
    { platform: 'claude', path: join(home, '.claude', 'skills') },
    { platform: 'codex', path: join(home, '.codex', 'skills') }
  ];
}

export function createSkillService(db: AppDatabase, options: SkillServiceOptions = {}) {
  const roots = options.roots ?? defaultSkillRoots();
  const packageDirectory = options.packageDirectory ?? join(homedir(), '.apm', 'skill-packages');

  return {
    getSkillRoots(): SkillRoot[] {
      return roots;
    },

    async scanSkills(scanRoots: SkillRoot[] = roots): Promise<SkillRecord[]> {
      const skills: SkillRecord[] = [];
      for (const root of scanRoots) {
        skills.push(...(await scanRoot(root)));
      }

      db.run('DELETE FROM skills');
      for (const skill of skills) {
        db.run(
          `INSERT OR REPLACE INTO skills
            (id, platform, name, description, root_path, entry_file_path, file_count, files, updated_at, packageable, install_state)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            skill.id,
            skill.platform,
            skill.name,
            skill.description,
            skill.rootPath,
            skill.entryFilePath,
            skill.fileCount,
            JSON.stringify(skill.files),
            skill.updatedAt,
            skill.packageable ? 1 : 0,
            skill.installState
          ]
        );
      }
      await db.save();
      return this.listSkills();
    },

    async listSkills(): Promise<SkillRecord[]> {
      return db
        .all<SkillRow>('SELECT * FROM skills ORDER BY platform ASC, name ASC')
        .map(rowToSkill);
    },

    async packageSkill(skillId: string): Promise<{ path: string }> {
      const skill = getSkillOrThrow(db, skillId);
      const entries = await Promise.all(
        skill.files.map(async (file) => ({
          name: `${basename(skill.rootPath)}/${file.replaceAll('\\', '/')}`,
          data: await readFile(join(skill.rootPath, file))
        }))
      );
      const outputPath = join(packageDirectory, `${sanitizeFileName(skill.name)}-${Date.now()}.zip`);
      await writeZipFile(outputPath, entries);
      return { path: outputPath };
    },

    async installSkill(skillId: string, targetPlatform: SkillPlatform): Promise<{ path: string; warning?: string }> {
      const skill = getSkillOrThrow(db, skillId);
      const targetRoot = roots.find((root) => root.platform === targetPlatform)?.path ?? defaultRootFor(targetPlatform);
      const targetPath = join(targetRoot, basename(skill.rootPath));

      if (await pathExists(targetPath)) {
        return {
          path: targetPath,
          warning: `Skill already exists: ${targetPath}`
        };
      }

      await mkdir(targetRoot, { recursive: true });
      await cp(skill.rootPath, targetPath, { recursive: true, force: false, errorOnExist: true });
      return { path: targetPath };
    }
  };
}

async function scanRoot(root: SkillRoot): Promise<SkillRecord[]> {
  let entries;
  try {
    entries = await readdir(root.path, { withFileTypes: true });
  } catch {
    return [];
  }

  const skills: SkillRecord[] = [];
  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }
    const rootPath = join(root.path, entry.name);
    const entryFilePath = join(rootPath, 'SKILL.md');
    if (!(await pathExists(entryFilePath))) {
      continue;
    }
    const files = await listFiles(rootPath);
    const manifest = await readSkillManifest(entryFilePath);
    const stats = await Promise.all(files.map((file) => stat(join(rootPath, file))));
    const latestMtime = stats.reduce(
      (latest, fileStat) => Math.max(latest, fileStat.mtimeMs),
      0
    );
    skills.push({
      id: skillId(root.platform, rootPath),
      platform: root.platform,
      name: manifest.name ?? entry.name,
      description: manifest.description ?? '',
      rootPath,
      entryFilePath,
      fileCount: files.length,
      files,
      updatedAt: new Date(latestMtime || Date.now()).toISOString(),
      packageable: files.length > 0,
      installState: 'installed'
    });
  }
  return skills;
}

async function listFiles(rootPath: string): Promise<string[]> {
  const result: string[] = [];
  async function walk(currentPath: string): Promise<void> {
    const entries = await readdir(currentPath, { withFileTypes: true });
    for (const entry of entries) {
      const absolutePath = join(currentPath, entry.name);
      if (entry.isDirectory()) {
        await walk(absolutePath);
        continue;
      }
      if (entry.isFile()) {
        result.push(relative(rootPath, absolutePath).replaceAll('\\', '/'));
      }
    }
  }
  await walk(rootPath);
  return result.sort((left, right) => left.localeCompare(right));
}

async function readSkillManifest(entryFilePath: string): Promise<SkillManifest> {
  const content = await readFile(entryFilePath, 'utf8');
  if (!content.startsWith('---')) {
    return { name: null, description: null };
  }
  const endIndex = content.indexOf('\n---', 3);
  if (endIndex === -1) {
    return { name: null, description: null };
  }
  const frontmatter = content.slice(3, endIndex).split(/\r?\n/);
  const values = new Map<string, string>();
  for (const line of frontmatter) {
    const match = /^([A-Za-z0-9_-]+):\s*(.*)$/.exec(line);
    if (match) {
      values.set(match[1].toLowerCase(), match[2].trim().replace(/^["']|["']$/g, ''));
    }
  }
  return {
    name: values.get('name') ?? null,
    description: values.get('description') ?? null
  };
}

function getSkillOrThrow(db: AppDatabase, skillIdValue: string): SkillRecord {
  const row = db.get<SkillRow>('SELECT * FROM skills WHERE id = ?', [skillIdValue]);
  if (!row) {
    throw new Error(`Skill not found: ${skillIdValue}`);
  }
  return rowToSkill(row);
}

function rowToSkill(row: SkillRow): SkillRecord {
  return {
    id: row.id,
    platform: row.platform as SkillPlatform,
    name: row.name,
    description: row.description,
    rootPath: row.root_path,
    entryFilePath: row.entry_file_path,
    fileCount: row.file_count,
    files: JSON.parse(row.files) as string[],
    updatedAt: row.updated_at,
    packageable: row.packageable === 1,
    installState: row.install_state as SkillRecord['installState']
  };
}

function skillId(platform: SkillPlatform, rootPath: string): string {
  return createHash('sha256').update(`${platform}:${rootPath}`).digest('hex').slice(0, 20);
}

function defaultRootFor(platform: SkillPlatform): string {
  return join(homedir(), platform === 'claude' ? '.claude' : '.codex', 'skills');
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

function sanitizeFileName(value: string): string {
  const sanitized = value.trim().toLowerCase().replace(/[^a-z0-9._-]+/g, '-').replace(/^-+|-+$/g, '');
  return sanitized || 'skill';
}
