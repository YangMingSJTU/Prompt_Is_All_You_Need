import { describe, expect, it } from 'vitest';
import { createPlatformPathContext } from '../desktop/main/services/platformPaths';
import { resolveScanRequest } from '../desktop/main/services/scanRequest';
import type { ScanSourceConfig } from '../desktop/shared/types';

const windowsContext = createPlatformPathContext('win32');
const savedSources: ScanSourceConfig[] = [
  {
    provider: 'codex',
    target: 'spells',
    path: 'C:\\Users\\Ada\\.codex',
    enabled: true
  },
  {
    provider: 'claude',
    target: 'spells',
    path: '\\\\server\\share\\claude',
    enabled: false
  }
];

describe('scan request boundary', () => {
  it('uses only saved main-process sources selected by provider', () => {
    expect(
      resolveScanRequest(
        { target: 'spells', providers: ['codex', 'codex'] },
        savedSources,
        windowsContext
      )
    ).toEqual({
      target: 'spells',
      providers: ['codex'],
      scanSources: [savedSources[0]]
    });
  });

  it.each([
    '../history.jsonl',
    '/Users/Ada/.codex/history.jsonl',
    '',
    '\\\\.\\PhysicalDrive0',
    '\\\\?\\C:\\Users\\Ada\\history.jsonl'
  ])('rejects renderer-provided scan path %s', (path) => {
    expect(() =>
      resolveScanRequest(
        {
          target: 'spells',
          providers: ['codex'],
          scanSources: [
            { provider: 'codex', target: 'spells', path, enabled: true }
          ]
        },
        savedSources,
        windowsContext
      )
    ).toThrow('Scan paths must be configured through settings');
  });

  it.each([
    '../history.jsonl',
    '/Users/Ada/.codex/history.jsonl',
    '',
    '\\\\.\\PhysicalDrive0',
    '\\\\?\\C:\\Users\\Ada\\history.jsonl',
    '\\\\server'
  ])('rejects an invalid saved Windows source %s', (path) => {
    expect(() =>
      resolveScanRequest(
        { target: 'spells', providers: ['codex'] },
        [{ ...savedSources[0], path }],
        windowsContext
      )
    ).toThrow('Saved scan source configuration is invalid');
  });

  it('rejects malformed providers and targets before accessing files', () => {
    expect(() =>
      resolveScanRequest(
        { target: 'skills', providers: ['codex'] },
        savedSources,
        windowsContext
      )
    ).toThrow('Invalid scan target');
    expect(() =>
      resolveScanRequest(
        { target: 'spells', providers: ['manual'] },
        savedSources,
        windowsContext
      )
    ).toThrow('Invalid scan providers');
  });
});
