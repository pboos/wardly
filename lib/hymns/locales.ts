export const hymnLanguages = [
  { locale: "en", label: "English", churchLanguage: "eng" },
  { locale: "de", label: "Deutsch", churchLanguage: "deu" },
] as const;

export type HymnLocale = (typeof hymnLanguages)[number]["locale"];

export function isHymnLocale(value: unknown): value is HymnLocale {
  return hymnLanguages.some(({ locale }) => locale === value);
}

/** Unsupported or malformed locales have no catalog; never substitute numbering. */
export function resolveHymnLocale(value: string): HymnLocale | undefined {
  try {
    const language = new Intl.Locale(value).language;
    return isHymnLocale(language) ? language : undefined;
  } catch {
    return undefined;
  }
}
