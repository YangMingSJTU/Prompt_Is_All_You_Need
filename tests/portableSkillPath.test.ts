import { describe, expect, it } from 'vitest';
import { createPlatformPathContext } from '../desktop/main/services/platformPaths';
import {
  hasPortablePathCollision,
  isPortableRelativePath,
  isPortablePathSegment,
  nativePathToPortableRelative,
  portableCollisionKey,
  resolveInside
} from '../desktop/main/services/skillPath';

describe('portable skill paths', () => {
  it('accepts only the Windows and macOS filename intersection', () => {
    expect(isPortableRelativePath('references/example.md')).toBe(true);
    expect(isPortableRelativePath('资料/示例.md')).toBe(true);

    for (const value of [
      'CON',
      'con.txt',
      'NUL.json',
      'COM1',
      'LPT9.md',
      'trailing.',
      'trailing ',
      'bad:name',
      'bad*name',
      'bad\\name',
      'control\u0001name'
    ]) {
      expect(isPortablePathSegment(value), value).toBe(false);
    }
  });

  it('detects case and Unicode normalization collisions', () => {
    expect(hasPortablePathCollision(['README.md', 'readme.md'])).toBe(true);
    expect(hasPortablePathCollision(['café.md', 'cafe\u0301.md'])).toBe(true);
    expect(hasPortablePathCollision(['a/README.md', 'b/readme.md'])).toBe(false);
    expect(portableCollisionKey('Cafe\u0301/README.md')).toBe('café/readme.md');
  });

  it('converts native relative paths with target path operations', () => {
    const windows = createPlatformPathContext('win32');
    const mac = createPlatformPathContext('darwin');

    expect(
      nativePathToPortableRelative(
        'C:\\skills\\demo',
        'C:\\skills\\demo\\references\\example.md',
        windows
      )
    ).toBe('references/example.md');
    expect(
      nativePathToPortableRelative(
        '/Users/Ada/skills/demo',
        '/Users/Ada/skills/demo/references/example.md',
        mac
      )
    ).toBe('references/example.md');
    expect(
      nativePathToPortableRelative(
        '/Users/Ada/skills/demo',
        '/Users/Ada/skills/demo/bad\\name.md',
        mac
      )
    ).toBeNull();
  });

  it('contains Windows drive and UNC targets using injected semantics', () => {
    const windows = createPlatformPathContext('win32');
    expect(resolveInside('C:\\skills\\demo', 'references/example.md', windows)).toBe(
      'C:\\skills\\demo\\references\\example.md'
    );
    expect(resolveInside('\\\\server\\share\\demo', '../escape.md', windows)).toBeNull();
  });
});
