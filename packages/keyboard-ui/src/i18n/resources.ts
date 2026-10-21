import type { Resource } from 'i18next';
import { de } from './locales/de.js';
import { en } from './locales/en.js';
import { es } from './locales/es.js';
import { fr } from './locales/fr.js';
import { it } from './locales/it.js';
import { ja } from './locales/ja.js';
import { ko } from './locales/ko.js';
import { nl } from './locales/nl.js';
import { pt } from './locales/pt.js';
import { ru } from './locales/ru.js';
import { zhCN } from './locales/zh-CN.js';
import { zhTW } from './locales/zh-TW.js';
/** All original languages; only namespaces/keys referenced by retained source are included. */
export const resources: Resource = {
  de: de,
  en: en,
  es: es,
  fr: fr,
  it: it,
  ja: ja,
  ko: ko,
  nl: nl,
  pt: pt,
  ru: ru,
  'zh-CN': zhCN,
  'zh-TW': zhTW,
};
