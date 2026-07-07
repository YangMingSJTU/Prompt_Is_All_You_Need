import { describe, expect, it } from 'vitest';
import { createTranslator, detectLocale } from '../desktop/renderer/i18n';

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
});
