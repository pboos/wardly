import assert from "node:assert/strict";
import test from "node:test";
import { findHymn, loadHymnCatalog } from "./index.ts";
import { hymnLanguages, isHymnLocale } from "./locales.ts";

test("catalogs have unique, sorted numbers and complete source counts", async () => {
  for (const { locale } of hymnLanguages) {
    const catalog = await loadHymnCatalog(locale);
    assert.equal(catalog.locale, locale);
    assert.ok(Number.isFinite(Date.parse(catalog.retrievedAt)));
    const numbers = catalog.hymns.map((hymn) => hymn.number);
    assert.equal(new Set(numbers).size, numbers.length);
    assert.deepEqual(
      numbers,
      [...numbers].sort((a, b) => a - b),
    );
    assert.equal(catalog.sources.length, 2);
    assert.equal(
      catalog.hymns.length,
      catalog.sources.reduce((sum, source) => sum + source.count, 0),
    );
    for (const source of catalog.sources) {
      assert.ok(source.count > 0);
      assert.equal(
        catalog.hymns.filter((hymn) => hymn.collection === source.collection)
          .length,
        source.count,
      );
    }
    for (const hymn of catalog.hymns) {
      assert.ok(Number.isSafeInteger(hymn.number) && hymn.number > 0);
      assert.ok(hymn.title.trim());
    }
  }
});

test("lookup uses ward language, including regional locales", async () => {
  assert.equal((await findHymn("de-CH", 1)).title, "Der Morgen naht");
  assert.equal((await findHymn("en-US", 1)).title, "The Morning Breaks");
  for (const locale of ["en", "de"]) {
    assert.equal(
      (await findHymn(locale, 1001)).collection,
      "hymns-for-home-and-church",
    );
    assert.equal(await findHymn(locale, -1), undefined);
    assert.equal(await findHymn(locale, 999999), undefined);
  }
  assert.equal(await loadHymnCatalog("fr"), undefined);
  assert.equal(await loadHymnCatalog("invalid_locale"), undefined);
  assert.equal(await findHymn("fr", 1), undefined);
  assert.equal(isHymnLocale("de"), true);
  assert.equal(isHymnLocale("de-CH"), false);
  assert.equal(isHymnLocale(null), false);
});
