import { execFileSync } from "node:child_process";
import { mkdir, readFile, writeFile, rename } from "node:fs/promises";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { hymnLanguages } from "../lib/hymns/locales.ts";

const root = fileURLToPath(new URL("../", import.meta.url));
const args = process.argv.slice(2);
const locale = args[0];
const language = hymnLanguages.find((item) => item.locale === locale);
if (!language || args.length > 2) {
  throw new Error(
    "Usage: node scripts/update-hymns.mjs <locale> [output-directory]",
  );
}
const directory = resolve(args[1] ?? resolve(root, "lib/hymns/data"));
const target = resolve(directory, `${locale}.json`);
const base = "https://www.churchofjesuschrist.org/media/music";
const collections = ["hymns", "hymns-for-home-and-church"];
const hymns = [];
const sources = [];

for (const collection of collections) {
  let offset = 0;
  let total;
  const seen = new Set();
  do {
    const url = new URL(`${base}/api`);
    url.search = new URLSearchParams({
      type: "songsFilteredList",
      lang: language.churchLanguage,
      batchSize: "20",
      identifier: JSON.stringify({
        lang: language.churchLanguage,
        limit: 500,
        offset,
        orderByKey: ["songTitleSortKey"],
        bookQueryList: [collection],
      }),
    }).toString();
    const response = JSON.parse(
      execFileSync(
        "curl",
        [
          "--silent",
          "--show-error",
          "--fail",
          "--location",
          "--max-time",
          "60",
          url.href,
        ],
        { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
      ),
    );
    if (
      !Array.isArray(response.data) ||
      !Number.isInteger(response.total) ||
      response.total < 1 ||
      response.offset !== offset ||
      (total !== undefined && total !== response.total)
    ) {
      throw new Error(
        `Invalid or changing response for ${collection}; no files written.`,
      );
    }
    total = response.total;
    if (!response.data.length) throw new Error(`Incomplete ${collection}`);
    for (const song of response.data) {
      if (
        song.bookSlug !== collection ||
        !/^\d+$/.test(song.songNumber) ||
        typeof song.title !== "string" ||
        !song.title.trim()
      ) {
        throw new Error(
          `Unexpected hymn: ${JSON.stringify({ number: song.songNumber, title: song.title })}`,
        );
      }
      const number = Number(song.songNumber);
      if (!Number.isSafeInteger(number) || number < 1 || seen.has(number)) {
        throw new Error(
          `Invalid or duplicate number ${number} in ${collection}`,
        );
      }
      seen.add(number);
      hymns.push({ number, title: song.title.trim(), collection });
    }
    offset += response.data.length;
  } while (offset < total);
  if (offset !== total) throw new Error(`Count mismatch for ${collection}`);
  sources.push({
    collection,
    url: `${base}/collections/${collection}?lang=${language.churchLanguage}`,
    count: total,
  });
  console.log(`${locale}: ${collection}: ${total} hymns`);
}

hymns.sort((a, b) => a.number - b.number);
if (new Set(hymns.map((hymn) => hymn.number)).size !== hymns.length) {
  throw new Error(
    "Collections have overlapping numbers; resolve catalog identity before importing.",
  );
}
let previous;
try {
  previous = JSON.parse(await readFile(target, "utf8"));
} catch (error) {
  if (error.code !== "ENOENT") throw error;
}
if (previous) {
  const missing = previous.hymns.filter(
    (old) =>
      !hymns.some(
        (hymn) =>
          hymn.number === old.number && hymn.collection === old.collection,
      ),
  );
  if (missing.length)
    throw new Error(
      `Refusing to remove ${missing.length} hymns. Generate into a temporary directory and investigate.`,
    );
  if (JSON.stringify(previous.hymns) === JSON.stringify(hymns)) {
    console.log("Catalog unchanged.");
    process.exit(0);
  }
}
const catalog = {
  locale,
  retrievedAt: new Date().toISOString(),
  sources,
  hymns,
};
await mkdir(dirname(target), { recursive: true });
await writeFile(`${target}.tmp`, `${JSON.stringify(catalog, null, 2)}\n`);
await rename(`${target}.tmp`, target);
console.log(`Saved ${hymns.length} hymns to ${target}`);
