import {
  lstat,
  mkdir,
  readFile,
  readdir,
  realpath,
  rename,
  rmdir,
  rm,
  writeFile
} from 'node:fs/promises';
import type { Dirent, Stats } from 'node:fs';

export interface SkillFileSystem {
  lstat(path: string): Promise<Stats>;
  mkdir(path: string, options?: { recursive?: boolean }): Promise<string | undefined>;
  readFile(path: string): Promise<Buffer>;
  readdir(path: string): Promise<Dirent[]>;
  realpath(path: string): Promise<string>;
  rename(oldPath: string, newPath: string): Promise<void>;
  rmdir(path: string): Promise<void>;
  rm(path: string, options: { recursive: boolean; force: boolean }): Promise<void>;
  writeFile(path: string, data: Uint8Array): Promise<void>;
}

export const nodeSkillFileSystem: SkillFileSystem = {
  lstat,
  mkdir,
  readFile,
  readdir: (path) => readdir(path, { withFileTypes: true }),
  realpath,
  rename,
  rmdir,
  rm,
  writeFile
};
