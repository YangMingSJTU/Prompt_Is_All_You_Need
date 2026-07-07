import { describe, expect, it } from 'vitest';
import { resolveAppLocale, resolveAppName } from '../desktop/shared/appIdentity';

describe('app identity', () => {
  it('uses Chinese app name when language is zh', () => {
    expect(resolveAppName('zh', 'en-US')).toBe('魔法书');
  });

  it('uses English app name when language is en', () => {
    expect(resolveAppName('en', 'zh-CN')).toBe('Spellbook');
  });

  it('uses system locale when language follows system', () => {
    expect(resolveAppLocale('system', 'zh-CN')).toBe('zh');
    expect(resolveAppName('system', 'zh-CN')).toBe('魔法书');
    expect(resolveAppLocale('system', 'en-US')).toBe('en');
    expect(resolveAppName('system', 'en-US')).toBe('Spellbook');
  });
});
