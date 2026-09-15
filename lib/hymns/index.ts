import { resolveHymnLocale, type HymnLocale } from "./locales.ts";

export type Hymn = Readonly<{
  number: number;
  title: string;
  collection: string;
}>;

export type HymnCatalog = Readonly<{
  locale: string;
  retrievedAt: string;
  sources: readonly Readonly<{
    collection: string;
    url: string;
    count: number;
  }>[];
  hymns: readonly Hymn[];
}>;

const loaders: Record<HymnLocale, () => Promise<HymnCatalog>> = {
  en: async () =>
    (await import("./data/en.json", { with: { type: "json" } })).default,
  de: async () =>
    (await import("./data/de.json", { with: { type: "json" } })).default,
};

/** Loads a bundled snapshot, with no runtime network or database access. */
export async function loadHymnCatalog(
  locale: string,
): Promise<HymnCatalog | undefined> {
  const language = resolveHymnLocale(locale);
  return language ? loaders[language]() : undefined;
}

/** Pass the ward's content_locale. Numbers are specific to each language. */
export async function findHymn(
  locale: string,
  number: number,
): Promise<Hymn | undefined> {
  const catalog = await loadHymnCatalog(locale);
  return catalog?.hymns.find((hymn) => hymn.number === number);
}
