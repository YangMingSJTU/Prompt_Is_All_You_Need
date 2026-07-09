import { describe, expect, it } from 'vitest';
import { createTranslator, detectLocale, resolveLocalePreference } from '../desktop/renderer/i18n';

describe('i18n', () => {
  it('uses Chinese for zh local language', () => {
    const t = createTranslator(detectLocale('zh-CN'));

    expect(t('nav.panel')).toBe('快捷施法');
    expect(t('settings.quickPanelShortcut')).toBe('快捷施法');
    expect(t('nav.library')).toBe('咒语库');
    expect(t('nav.skills')).toBe('技能库');
    expect(t('nav.analytics')).toBe('施法统计');
    expect(t('analytics.usage')).toBe('施法概览');
    expect(t('analytics.topCopied')).toBe('常用咒语');
    expect(t('floating.placeholder')).toBe('输入关键词搜索咒语');
  });

  it('uses English for English local language', () => {
    const t = createTranslator(detectLocale('en-US'));

    expect(t('nav.panel')).toBe('Quick Panel');
    expect(t('nav.library')).toBe('Spell Library');
    expect(t('nav.skills')).toBe('Skill Library');
    expect(t('nav.analytics')).toBe('Analytics');
    expect(t('analytics.usage')).toBe('Usage');
    expect(t('analytics.topCopied')).toBe('Top copied spells');
    expect(t('floating.placeholder')).toBe('Search spells');
  });

  it('falls back to Chinese for unsupported languages', () => {
    const t = createTranslator(detectLocale('ja-JP'));

    expect(t('nav.panel')).toBe('快捷施法');
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

    expect(zh('app.brand')).toBe('魔法书');
    expect(en('app.brand')).toBe('Spellbook');
    expect(zh('app.subtitle')).toBe('AI 提示词与技能管理器');
    expect(zh('status.ready')).toBe('');
    expect(en('status.ready')).toBe('');
    expect(zh('app.version')).toBe('');
    expect(zh('home.title')).toBe('');
    expect(zh('home.description')).toBe('');
    expect(zh('scanner.localOnly')).toBe('');
    expect(zh('scanner.description')).toBe('');
    expect(zh('settings.shortcut.description')).toBe('');
    expect(en('settings.shortcut.description')).toBe('');
  });

  it('does not expose retired Prompt Miner or Snippet product copy', () => {
    const zh = createTranslator(detectLocale('zh-CN'));
    const en = createTranslator(detectLocale('en-US'));
    const visibleCopy = [
      zh('app.brand'),
      zh('nav.library'),
      zh('floating.placeholder'),
      zh('library.title'),
      zh('library.candidates'),
      zh('analytics.empty'),
      en('app.brand'),
      en('nav.library'),
      en('floating.placeholder'),
      en('library.title'),
      en('library.candidates'),
      en('analytics.empty')
    ].join(' ');

    expect(visibleCopy).not.toContain('Prompt Miner');
    expect(visibleCopy).not.toContain('Snippet');
    expect(visibleCopy).not.toContain('snippet');
  });

  it('uses spell traits copy instead of tags in the library UI', () => {
    const zh = createTranslator(detectLocale('zh-CN'));
    const en = createTranslator(detectLocale('en-US'));
    const zhCopy = [
      zh('spell.placeholder'),
      zh('spell.search'),
      zh('spell.tags'),
      zh('spell.tagPlaceholder'),
      zh('spell.addTag'),
      zh('spell.allTags')
    ].join(' ');
    const enCopy = [
      en('spell.placeholder'),
      en('spell.search'),
      en('spell.tags'),
      en('spell.tagPlaceholder'),
      en('spell.addTag'),
      en('spell.allTags')
    ].join(' ');

    expect(zh('spell.tags')).toBe('属性');
    expect(zh('spell.tagPlaceholder')).toBe('输入属性');
    expect(zh('spell.addTag')).toBe('添加属性');
    expect(zh('spell.allTags')).toBe('全部属性');
    expect(zhCopy).not.toContain('标签');
    expect(en('spell.tags')).toBe('Traits');
    expect(en('spell.tagPlaceholder')).toBe('Enter trait');
    expect(en('spell.addTag')).toBe('Add trait');
    expect(en('spell.allTags')).toBe('All traits');
    expect(enCopy).not.toContain('Tags');
    expect(enCopy).not.toContain('tags');
  });

  it('uses spell-themed analytics copy in Chinese without renaming English analytics', () => {
    const zh = createTranslator(detectLocale('zh-CN'));
    const en = createTranslator(detectLocale('en-US'));
    const zhAnalyticsCopy = [zh('nav.analytics'), zh('analytics.usage'), zh('analytics.topCopied')].join(' ');

    expect(zhAnalyticsCopy).toContain('施法统计');
    expect(zhAnalyticsCopy).toContain('施法概览');
    expect(zhAnalyticsCopy).toContain('常用咒语');
    expect(zhAnalyticsCopy).not.toContain('使用分析');
    expect(zhAnalyticsCopy).not.toContain('使用情况');
    expect(zhAnalyticsCopy).not.toContain('最常复制');
    expect(en('nav.analytics')).toBe('Analytics');
  });
});
