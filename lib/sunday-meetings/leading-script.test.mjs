import assert from "node:assert/strict";
import test from "node:test";
import en from "./leading-copy/en.json" with { type: "json" };
import de from "./leading-copy/de.json" with { type: "json" };
import { buildLeadingScript, parseLeadingMode } from "./leading-script.ts";
import { SUNDAY_MEETING_ITEM_TYPES } from "./types.ts";

const item = (id, type, extra = {}) => ({ id, type, section: "program", orderIndex: 0, slot: null, content: null, metadata: null, personNameResolved: "Alex Example", task: null, ...extra });
const build = (items, locale = "en", extra = {}, mode) => buildLeadingScript({ meeting: { id: "meeting", type: "sacrament", items, information: null, ...extra }, mode, contentLocale: locale, hymns: [{ number: 1, title: "Example Hymn", collection: "hymns" }] });
const blocks = script => script.sections.flatMap(section => section.blocks);
const paragraphs = script => [...script.introduction, ...blocks(script).flatMap(block => block.paragraphs)];
const spans = paragraph => paragraph.kind === "rule" ? [] : paragraph.kind === "list" ? paragraph.rows.flat() : paragraph.spans;
const line = paragraph => spans(paragraph).map(span => span.text).join("");
const words = script => paragraphs(script).map(line).join("\n");

test("bundled copy shares keys and placeholders", () => {
  assert.deepEqual(Object.keys(de).sort(), Object.keys(en).sort());
  for (const key of Object.keys(en)) {
    const tokens = value => [...new Set(value.match(/\{\w+\}/g) ?? [])].sort();
    assert.deepEqual(tokens(de[key]), tokens(en[key]), key);
  }
});

for (const locale of ["en-US", "de-CH"]) {
  const copy = locale.startsWith("de") ? de : en;
  test(`${locale}: introduction is role list, greeting and individual visitors`, () => {
    const script = build([
      item("presiding", "presiding", { section: "participants" }),
      item("leader", "leader", { section: "participants", personNameResolved: "Robin Example" }),
      item("visitor", "visitor", { section: "participants", personNameResolved: "Taylor Example", content: "Guest role" }),
      item("visitor2", "visitor", { section: "participants", personNameResolved: "Casey Example" }),
    ], locale, { information: "Literal <text>\nNext line" });
    assert.equal(script.introduction[0].kind, "list");
    assert.equal(script.introduction[0].rows.length, 2);
    assert.equal(line(script.introduction[1]), copy.greeting);
    assert.equal(line(script.introduction[2]), copy.visitor);
    assert.equal(script.introduction[3].rows.length, 2);
    assert.ok(words(script).includes("Taylor Example, Guest role"));
    assert.ok(words(script).includes("Literal <text>\nNext line"));
  });
  test(`${locale}: calling blocks release first, rich lists, exact vote prose, no editorial details`, () => {
    const script = build([
      item("sustain", "calling_sustain", { content: "New office", task: { title: "Other office", description: "Private editorial instruction" } }),
      item("release", "calling_release", { orderIndex: 1, personNameResolved: "Robin Example", task: { title: "Former office" } }),
      item("sustain2", "calling_sustain", { orderIndex: 2, personNameResolved: "Taylor Example", content: "Second office" }),
    ], locale);
    const p = blocks(script)[0].paragraphs;
    assert.deepEqual(p.map(entry => entry.kind), ["heading", "spoken", "list", "spoken", "heading", "spoken", "list", "spoken", "spoken", "spoken"]);
    assert.deepEqual(p.filter(entry => entry.kind === "heading").map(line), [copy.releaseHeading, copy.sustainHeading]);
    assert.equal(line(p[1]), copy.calling_release);
    assert.equal(line(p[3]), copy.releaseVote);
    assert.equal(line(p[5]), copy.calling_sustain);
    assert.equal(line(p[7]), copy.sustainVote);
    assert.equal(line(p[8]), copy.opposed);
    assert.equal(line(p[9]), copy.voteThanks);
    assert.equal(p[6].rows.length, 2);
    assert.equal(p[6].rows[0][0].kind, "name");
    assert.ok(words(script).includes("Robin Example: Former office"));
    assert.ok(!words(script).includes("Private editorial instruction"));
    assert.ok(!words(script).includes("Other office"));
  });
  test(`${locale}: unrelated and Aaronic rows divide calling runs`, () => {
    const script = build([
      item("a", "calling_sustain"),
      item("custom", "custom_program", { orderIndex: 1, content: "Authored words" }),
      item("b", "calling_release", { orderIndex: 2 }),
      item("aaronic", "priesthood_aaronic_inform", { orderIndex: 3, content: "Quorum assignment" }),
      item("c", "calling_sustain", { orderIndex: 4 }),
    ], locale);
    assert.deepEqual(blocks(script).map(block => block.id), ["a", "custom", "b", "aaronic", "c", "final-wish"]);
    assert.ok(words(script).includes("Authored words"));
    assert.equal((words(script).match(/Quorum assignment/g) ?? []).length, 1);
  });
  for (const mode of ["notes", "detailed"]) {
    test(`${locale}/${mode}: opening and closing text, adjacent pairing and no prayer thanks`, () => {
      const hymn = item("h", "hymn", { section: "opening", slot: "opening_hymn", metadata: { hymnNumber: 1 } });
      const prayer = item("p", "prayer", { section: "opening", slot: "opening_prayer", orderIndex: 1 });
      const script = build([hymn, prayer,
        item("ch", "hymn", { section: "closing", slot: "closing_hymn", metadata: { hymnNumber: 1 } }),
        item("cp", "prayer", { section: "closing", slot: "closing_prayer", orderIndex: 1 }),
      ], locale, {}, mode);
      const output = blocks(script).flatMap(block => block.paragraphs).map(line);
      assert.deepEqual(output, mode === "notes" ? [
        copy.openingHymnNotes.replace("{number}", "1").replace("{title}", "Example Hymn"),
        copy.openingPrayerNotes.replace("{people}", "Alex Example"),
        copy.closingHymnNotes.replace("{number}", "1").replace("{title}", "Example Hymn"),
        copy.closingPrayerNotes.replace("{people}", "Alex Example"), copy.finalWish,
      ] : [
        copy.pair.replace("{hymn}", copy.hymnName.replace("{number}", "1").replace("{title}", "Example Hymn")).replace("{people}", "Alex Example"),
        copy.closingPair.replace("{hymn}", copy.hymnName.replace("{number}", "1").replace("{title}", "Example Hymn")).replace("{people}", "Alex Example"), copy.finalWish,
      ]);
      const separated = build([hymn, item("c", "conductor_text", { section: "opening", orderIndex: 1, content: "Saved text" }), { ...prayer, orderIndex: 2 }], locale, {}, mode);
      assert.ok(!spans(blocks(separated)[0].paragraphs[0]).some(span => span.kind === "name"));
      for (const placement of [{ section: "opening" }, { section: "program" }, { section: "closing" }, { section: "program", slot: "closing_prayer" }]) {
        const prayerScript = build([item("prayer", "prayer", placement)], locale, {}, mode);
        assert.ok(!words(prayerScript).match(/Thank you|Vielen Dank/));
      }
    });
    test(`${locale}/${mode}: musician thanks are headed role rows with assigned names only`, () => {
      for (const count of [1, 2]) {
        const musicians = ["organist", "music_conductor"].flatMap(role => Array.from({ length: count }, (_, index) => item(`${role}${index}`, role, { section: "participants", personNameResolved: `Musician ${role} ${index}` })));
        const script = build([...musicians,
          item("missing", "organist", { section: "participants", personNameResolved: null }),
          item("text", "conductor_text", { section: "closing", content: "Closing authored words", personNameResolved: null }),
          item("h", "hymn", { section: "closing", orderIndex: 1, slot: "closing_hymn", metadata: { hymnNumber: 1 } }),
          item("p", "prayer", { section: "closing", orderIndex: 2, slot: "closing_prayer" }),
        ], locale, {}, mode);
        assert.deepEqual(blocks(script).map(block => block.id), ["text", "musician-thanks", "h", ...(mode === "notes" ? ["p"] : []), "final-wish"]);
        const thanks = blocks(script)[1].paragraphs;
        assert.equal(line(thanks[0]), copy.musicHeading);
        assert.equal(thanks[1].kind, "list");
        for (const [index, role] of ["organist", "music_conductor"].entries()) {
          const expectedNames = Array.from({ length: count }, (_, i) => `Musician ${role} ${i}`).join(copy.and);
          assert.equal(thanks[1].rows[index].map(span => span.text).join(""), copy[role].replace("{people}", expectedNames));
          assert.equal(thanks[1].rows[index].filter(span => span.kind === "name").length, count);
        }
        assert.ok(!words(script).match(/Thank you|Vielen Dank/));
        const noClosing = build(musicians, locale, {}, mode);
        assert.deepEqual(blocks(noClosing).map(block => block.id), ["musician-thanks", "final-wish"]);
      }
    });
    test(`${locale}/${mode}: sacrament has a stop rule, hides assignments and controls thanks`, () => {
      const script = build([
        item("h", "hymn", { section: "sacrament", slot: "sacrament_hymn", metadata: { hymnNumber: 1 } }),
        item("blessing", "sacrament_blessing", { section: "sacrament", orderIndex: 1, personNameResolved: "Hidden Blesser", content: "Hidden details" }),
        item("passing", "sacrament_passing", { section: "sacrament", orderIndex: 2, personNameResolved: "Hidden Passer" }),
      ], locale, {}, mode);
      const sacrament = script.sections.find(section => section.section === "sacrament").blocks;
      assert.deepEqual(sacrament[0].paragraphs.map(line), mode === "notes" ? [
        copy.sacramentHymnNotes.replace("{number}", "1").replace("{title}", "Example Hymn"), copy.sacramentDistribution, "",
      ] : [copy.sacramentHymn.replace("{hymn}", copy.hymnName.replace("{number}", "1").replace("{title}", "Example Hymn")), ""]);
      assert.equal(sacrament[0].paragraphs.at(-1).kind, "rule");
      assert.equal(sacrament.length, mode === "notes" ? 1 : 2);
      if (mode === "detailed") assert.equal(line(sacrament[1].paragraphs[0]), copy.sacramentThanks);
      assert.ok(!words(script).includes("Hidden"));
      assert.ok(!words(script).match(/abwarten|Pause|Warten,|innehalten|wait/i));
    });
    test(`${locale}/${mode}: talks omit topics and thanks, hymns and musical numbers remain`, () => {
      const script = build([
        item("a", "talk", { content: "Hidden topic", task: { title: "Hidden title", description: "Hidden description" } }),
        item("b", "talk", { orderIndex: 1, personNameResolved: "Robin Example" }),
        item("h", "hymn", { orderIndex: 2, slot: "interlude", metadata: { hymnNumber: 1 } }),
        item("c", "talk", { orderIndex: 3, personNameResolved: "Taylor Example" }),
        item("music", "musical_number", { orderIndex: 4, content: "Named work", personNameResolved: null }),
        item("transition", "transition", { orderIndex: 5, personNameResolved: null }),
        item("extra-hymn", "hymn", { orderIndex: 6, metadata: { hymnNumber: 1 } }),
      ], locale, {}, mode);
      assert.deepEqual(blocks(script)[0].paragraphs.map(line), mode === "notes" ? [copy.talk.replace("{people}", "Alex Example"), copy.talk.replace("{people}", "Robin Example")] : [copy.talksDetailed.replace("{people}", "Alex Example" + copy.and + "Robin Example")]);
      assert.equal(line(blocks(script)[2].paragraphs[0]), copy[mode === "notes" ? "talk" : "talkDetailed"].replace("{people}", "Taylor Example"));
      assert.deepEqual(blocks(script)[3].paragraphs.map(line), [copy[mode === "notes" ? "musical_number" : "musicalNumberDetailed"].replace("{detail}", "Named work")]);
      assert.equal(blocks(script)[4].paragraphs[0].kind, "rule");
      assert.ok(!words(script).match(/Hidden|Thank you|Vielen Dank/));
      for (const hymnBlock of [blocks(script)[1], blocks(script)[5]]) {
        assert.deepEqual(spans(hymnBlock.paragraphs[0]).filter(span => span.kind === "emphasis").map(span => span.text), mode === "detailed" ? ["1", "Example Hymn"] : []);
      }
    });
    test(`${locale}/${mode}: final wish is always last, including without closing slots`, () => {
      assert.equal(line(paragraphs(build([], locale, {}, mode)).at(-1)), copy.finalWish);
      const script = build([item("closing", "conductor_text", { section: "closing", content: "Last saved words" })], locale, {}, mode);
      assert.equal(line(paragraphs(script).at(-1)), copy.finalWish);
    });
  }
  test(`${locale}: announcement headings identify contiguous groups and free text survives`, () => {
    const script = build([item("a", "announcement", { content: "First" }), item("b", "announcement", { orderIndex: 1, content: "Second" }), item("c", "conductor_text", { orderIndex: 2, content: "Literal <text>\nNext line" }), item("d", "announcement", { orderIndex: 3, content: "Third" })], locale);
    assert.equal(paragraphs(script).filter(p => p.kind === "heading" && line(p) === copy.announcements).length, 2);
    assert.ok(words(script).includes("Literal <text>\nNext line"));
  });
  test(`${locale}: testimony order, child baptism, all item types and no generated waits`, () => {
    const script = build(SUNDAY_MEETING_ITEM_TYPES.map((type, index) => item(type, type, { orderIndex: index, content: "Saved detail" })), locale, { type: "fast_testimony" });
    assert.ok(!words(script).match(/\{\w+\}/));
    assert.ok(paragraphs(script).every(p => ["spoken", "heading", "list", "rule"].includes(p.kind)));
    assert.ok(!words(script).match(/abwarten|Pause|Warten,|innehalten/));
    const child = build([item("child", "member_welcome", { task: { type: "child_baptism", title: "Saved task", description: "Saved description" } })], locale);
    assert.ok(words(child).includes(copy.childBaptism.replace("{people}", "Alex Example")));
    assert.ok(words(child).includes("Saved description"));
    const testimony = build([item("program", "conductor_text", { content: "Before testimonies" }), item("closing", "conductor_text", { section: "closing", content: "After testimonies" })], locale, { type: "fast_testimony" });
    assert.deepEqual(blocks(testimony).map(block => block.id), ["program", "testimony", "closing", "final-wish"]);
    assert.deepEqual(blocks(testimony)[1].paragraphs.map(line), [copy.testimony, copy.testimonyThanks]);
  });
}

test("German calling prose matches the notes exactly", () => {
  assert.equal(de.calling_release, "Mit aufrichtigem Dank für den geleisteten Dienst möchten wir folgende Geschwister aus ihren Berufungen entlassen");
  assert.equal(de.calling_sustain, "Wir schlagen euch zur Bestätigung folgende Geschwister neu zu einem Amt vor");
  assert.equal(de.releaseVote, "Wer sich unserem Dank anschliesst, zeige es bitte durch Heben der Hand.");
  assert.equal(de.sustainVote, "Wer dafür ist, sie zu unterstützen, kann es durch Heben der Hand zeigen.");
});

test("absent optional presider is omitted and required conductor remains explicit", () => {
  const script = build([]);
  assert.equal(script.introduction[0].rows.length, 1);
  assert.equal(line(script.introduction[0]), en.leader.replace("{people}", en.missingPerson));
});

test("unknown hymns and unsupported locale retain explicit prompts; empty interlude disappears", () => {
  const script = build([item("h", "hymn", { metadata: { hymnNumber: 9999 } }), item("empty", "hymn", { slot: "interlude" })], "fr");
  assert.ok(script.notice);
  assert.ok(words(script).includes("9999"));
  assert.ok(words(script).includes(en.unknownHymn));
  assert.ok(words(script).includes(en.missingPerson));
  assert.ok(!blocks(script).some(block => block.id === "empty"));
});

test("all local types render; conferences omit local ceremony", () => {
  for (const type of ["sacrament", "ward_conference", "fast_testimony", "childrens_sacrament_presentation"]) assert.equal(build([], "en", { type }).kind, "local");
  for (const type of ["stake_conference", "general_conference"]) {
    for (const mode of ["notes", "detailed"]) {
      const script = build([], "de", { type }, mode);
      assert.equal(script.kind, "nonlocal");
      assert.ok(!JSON.stringify(script).includes(de.finalWish));
    }
  }
});

test("only exact detailed URL mode opts into detailed text; notes is the builder default", () => {
  assert.equal(build([]).mode, "notes");
  assert.equal(parseLeadingMode("detailed"), "detailed");
  for (const value of [undefined, "notes", "Detailed", "", "other", ["detailed"], ["notes", "detailed"]]) assert.equal(parseLeadingMode(value), "notes");
});

test("detailed hymn spans emphasize resolved values while missing prompts stay missing", () => {
  for (const slot of ["opening_hymn", "closing_hymn", "sacrament_hymn", "interlude", null]) {
    for (const number of [1, 9999, undefined]) {
      const script = build([item("h", "hymn", { section: slot === "interlude" || slot === null ? "program" : "opening", slot, metadata: number ? { hymnNumber: number } : null })], "en", {}, "detailed");
      const hymnBlock = blocks(script).find(block => block.id === "h");
      if (slot === "interlude" && !number) { assert.equal(hymnBlock, undefined); continue; }
      const hymnSpans = spans(hymnBlock.paragraphs[0]);
      assert.deepEqual(hymnSpans.filter(span => span.kind === "emphasis").map(span => span.text), number === 1 ? ["1", "Example Hymn"] : number ? ["9999"] : []);
      if (number !== 1) assert.ok(hymnSpans.some(span => span.kind === "missing"));
      assert.ok(!hymnSpans.some(span => span.kind === "name"));
    }
  }
});

test("requested compact German sacrament and closing wording is exact", () => {
  const script = build([
    item("h", "hymn", { section: "sacrament", slot: "sacrament_hymn", metadata: { hymnNumber: 1 } }),
    item("ch", "hymn", { section: "closing", slot: "closing_hymn", metadata: { hymnNumber: 1 } }),
    item("cp", "prayer", { section: "closing", slot: "closing_prayer", orderIndex: 1 }),
  ], "de");
  assert.deepEqual(blocks(script).flatMap(block => block.paragraphs).map(line), [
    "Abendmahlslied: 1 - Example Hymn",
    "Nach dem Lied werden die Priestertumsträger das Abendmahl segnen und austeilen.",
    "",
    "Schlusslied: 1 - Example Hymn",
    "Schlussgebet: Alex Example",
    "Wir wünschen euch noch einen schönen Sonntag und eine gute Woche.",
  ]);
});
