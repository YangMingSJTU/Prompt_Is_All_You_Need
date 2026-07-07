import { describe, expect, it } from 'vitest';
import { createTranslator, detectLocale, resolveLocalePreference } from '../desktop/renderer/i18n';

describe('i18n', () => {
  it('uses Chinese for zh local language', () => {
    const t = createTranslator(detectLocale('zh-CN'));

    expect(t('nav.panel')).toBe('快捷面板');
    expect(t('floating.placeholder')).toBe('输入关键词搜索提示词');
  });

  it('uses English for English local language', () => {
    const t = createTranslator(detectLocale('en-US'));

    expect(t('nav.panel')).toBe('Quick Panel');
    expect(t('floating.placeholder')).toBe('Search prompts');
  });

  it('falls back to Chinese for unsupported languages', () => {
    const t = createTranslator(detectLocale('ja-JP'));

    expect(t('nav.panel')).toBe('快捷面板');
  });

  it('resolves persisted language preferences over system language', () => {
    expect(resolveLocalePreference('system', 'en-US')).toBe('en');
    expect(resolveLocalePreference('system', 'zh-CN')).toBe('zh');
    expect(resolveLocalePreference('zh', 'en-US')).toBe('zh');
    expect(resolveLocalePreference('en', 'zh-CN')).toBe('en');
  });

  it('uses compact chrome copy without persistent explanatory labels', () => {
    const zh = createTranslator(detectLocale('zh-CN'));
    const en = createTranslator(detectLocale('en-US'));

    expect(zh('app.brand')).toBe('Prompt Miner');
    expect(en('app.brand')).toBe('Prompt Miner');
    expect(zh('app.subtitle')).toBe('');
    expect(zh('app.version')).toBe('');
    expect(zh('home.title')).toBe('');
    expect(zh('home.description')).toBe('');
    expect(zh('scanner.localOnly')).toBe('');
    expect(zh('scanner.description')).toBe('');
  });
});
