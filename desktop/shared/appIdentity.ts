import type { AppLanguage } from './settings';

export type AppLocale = 'zh' | 'en';

export function resolveAppLocale(language: AppLanguage, systemLocale: string | undefined | null): AppLocale {
  if (language === 'zh' || language === 'en') {
    return language;
  }
  return (systemLocale ?? '').toLowerCase().startsWith('en') ? 'en' : 'zh';
}

export function resolveAppName(language: AppLanguage, systemLocale: string | undefined | null): string {
  return resolveAppLocale(language, systemLocale) === 'en' ? 'Spellbook' : '魔法书';
}
