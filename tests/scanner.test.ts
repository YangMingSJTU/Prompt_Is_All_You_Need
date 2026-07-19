import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  discoverJsonlFiles,
  hasSuccessfulSourceScan,
  isSkippedPath,
  nodeScannerFileSystem,
  scanJsonlFiles
} from '../desktop/main/services/scanner';
import {
  createPlatformPathContext,
  nativePlatformPathContext
} from '../desktop/main/services/platformPaths';

describe('scanner', () => {
  it('scans jsonl files and ignores tool results', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'apm-scan-'));
    const file = join(dir, 'history.jsonl');
    await writeFile(
      file,
      [
        JSON.stringify({ role: 'user', content: 'review current diff' }),
        JSON.stringify({ role: 'assistant', content: 'assistant content' }),
        JSON.stringify({ type: 'tool_result', content: 'secret tool output' })
      ].join('\n')
    );

    const result = await scanJsonlFiles([file], 'codex');

    expect(result.prompts).toHaveLength(1);
    expect(result.prompts[0].rawText).toBe('review current diff');
    expect(hasSuccessfulSourceScan(result.sourceFiles)).toBe(true);
    await rm(dir, { recursive: true, force: true });
  });

  it('does not treat unreadable history files as a successful refresh', async () => {
    const missingFile = join(tmpdir(), 'missing-spell-history.jsonl');
    const result = await scanJsonlFiles([missingFile], 'codex');

    expect(result.sourceFiles).toHaveLength(1);
    expect(result.sourceFiles[0]).toMatchObject({
      status: 'skipped',
      error: { code: 'io_error', path: missingFile, retryable: true }
    });
    expect(hasSuccessfulSourceScan(result.sourceFiles)).toBe(false);
  });

  it('distinguishes missing roots from successful empty scans', async () => {
    const root = await mkdtemp(join(tmpdir(), 'spellbook-discovery-'));
    try {
      await expect(discoverJsonlFiles(join(root, 'missing'))).resolves.toEqual({
        status: 'missing',
        files: [],
        errors: []
      });
      await expect(discoverJsonlFiles(root)).resolves.toEqual({
        status: 'success',
        files: [],
        errors: []
      });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('reports I/O failures instead of an empty success', async () => {
    await expect(discoverJsonlFiles('\u0000')).resolves.toMatchObject({
      status: 'failed',
      files: [],
      errors: [{ code: 'io_error' }]
    });
  });

  it('keeps readable siblings when one nested directory is denied', async () => {
    const root = await mkdtemp(join(tmpdir(), 'spellbook-partial-discovery-'));
    const readableDirectory = join(root, 'readable');
    const deniedDirectory = join(root, 'denied');
    const readableFile = join(readableDirectory, 'history.jsonl');
    await mkdir(readableDirectory);
    await mkdir(deniedDirectory);
    await writeFile(readableFile, JSON.stringify({ role: 'user', content: 'keep scanning' }));

    try {
      const result = await discoverJsonlFiles(root, {
        pathContext: nativePlatformPathContext,
        fs: {
          ...nodeScannerFileSystem,
          async readdir(path) {
            if (path === deniedDirectory) {
              throw Object.assign(new Error('permission denied'), {
                code: 'EACCES',
                path
              });
            }
            return nodeScannerFileSystem.readdir(path);
          }
        }
      });

      expect(result).toEqual({
        status: 'partial',
        files: [readableFile],
        errors: [
          { code: 'permission_denied', path: deniedDirectory, retryable: true }
        ]
      });
      const scan = await scanJsonlFiles(result.files, 'codex', {
        pathContext: nativePlatformPathContext
      });
      expect(scan.prompts.map((prompt) => prompt.rawText)).toEqual(['keep scanning']);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it('uses the injected platform path implementation for skipped segments', () => {
    expect(
      isSkippedPath(
        'C:\\Users\\Ada\\.codex\\tool-results\\history.jsonl',
        createPlatformPathContext('win32')
      )
    ).toBe(true);
    expect(
      isSkippedPath(
        '/Users/Ada/.codex/sessions/history.jsonl',
        createPlatformPathContext('darwin')
      )
    ).toBe(false);
  });
});
