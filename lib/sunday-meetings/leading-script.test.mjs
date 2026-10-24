import assert from "node:assert/strict";
import test from "node:test";
import en from "./leading-copy/en.json" with { type: "json" };
import de from "./leading-copy/de.json" with { type: "json" };
import { buildLeadingScript } from "./leading-script.ts";
import { SUNDAY_MEETING_ITEM_TYPES } from "./types.ts";

const item = (id, type, extra = {}) => ({ id, type, section: "program", orderIndex: 0, slot: null, content: null, metadata: null, personNameResolved: "Alex Example", task: null, ...extra });
const meeting = (items, extra = {}) => ({ id: "meeting", type: "sacrament", items, information: null, ...extra });
const build = (items, locale = "en", extra = {}) => buildLeadingScript({ meeting: meeting(items, extra), contentLocale: locale, hymns: [{ number: 1, title: "Example Hymn", collection: "hymns" }] });
const paragraphs = script => [...script.introduction, ...script.sections.flatMap(section => section.blocks.flatMap(block => block.paragraphs))];
const words = script => paragraphs(script).map(p => p.spans.map(span => span.text).join("")).join("\n");
const blocks = script => script.sections.flatMap(section => section.blocks);

test("bundled copy has identical keys and placeholder contracts", () => {
  assert.deepEqual(Object.keys(de).sort(), Object.keys(en).sort());
  for (const key of Object.keys(en)) {
    const tokens = value => [...new Set(value.match(/\{\w+\}/g) ?? [])].sort();
    assert.deepEqual(tokens(de[key]), tokens(en[key]), key);
  }
});

for (const locale of ["en-US", "de-CH"]) {
  test(`${locale}: follows saved order, pairs only adjacent hymn/prayer and retains literal details`, () => {
    const hymn = item("h", "hymn", { section: "opening", slot: "opening_hymn", metadata: { hymnNumber: 1 } });
    const prayer = item("p", "prayer", { section: "opening", slot: "opening_prayer", orderIndex: 2 });
    const custom = item("c", "conductor_text", { section: "opening", orderIndex: 1, content: "Literal <text>\nNext line" });
    const script = build([prayer, custom, hymn], locale);
    assert.deepEqual(blocks(script).map(block => block.id), ["h", "c", "p"]);
    assert.ok(words(script).includes("Literal <text>\nNext line"));
    assert.ok(words(script).includes("Example Hymn"));
    assert.equal(blocks(script)[0].paragraphs[0].spans.some(span => span.kind === "name"), false);
    const paired = build([hymn, { ...prayer, orderIndex: 1 }], locale);
    assert.ok(blocks(paired)[0].paragraphs[0].spans.some(span => span.kind === "name"));
    assert.equal(blocks(paired)[1].paragraphs[0].kind, "cue");
  });
  test(`${locale}: testimony follows saved program rows and precedes closing conductor text`, () => {
    const copy = locale.startsWith("de") ? de : en;
    const script = build([
      item("closing", "conductor_text", { section: "closing", content: "Closing conductor text", personNameResolved: null }),
      item("second", "custom_program", { orderIndex: 1, content: "Second program text", personNameResolved: null }),
      item("intro", "conductor_text", { content: "Program introduction", personNameResolved: null }),
    ], locale, { type: "fast_testimony" });
    assert.deepEqual(blocks(script).map(block => block.id), ["intro", "second", "testimony", "closing"]);
    const programAndClosing = script.sections
      .filter(section => section.section === "program" || section.section === "closing")
      .flatMap(section => section.blocks.flatMap(block => block.paragraphs))
      .map(paragraph => [paragraph.kind, paragraph.spans.map(span => span.text).join("")]);
    assert.deepEqual(programAndClosing, [
      ["spoken", "Program introduction"],
      ["spoken", "Second program text"],
      ["spoken", copy.testimony],
      ["cue", copy.testimonyCue],
      ["spoken", copy.testimonyThanks],
      ["spoken", "Closing conductor text"],
    ]);
  });
  test(`${locale}: adjacent talks share thanks; intervening rows break the run`, () => {
    const copy = locale.startsWith("de") ? de : en;
    const a = item("a", "talk", { content: "First topic" });
    const b = item("b", "talk", { orderIndex: 1, personNameResolved: "Robin Example" });
    const script = build([a, b], locale);
    assert.equal(blocks(script).length, 1);
    assert.ok(words(script).includes(copy.talksThanks.replace("{people}", "Alex Example" + copy.and + "Robin Example")));
    const partlyMissing = build([a, { ...b, personNameResolved: null }], locale);
    assert.ok(words(partlyMissing).includes(copy.talksThanks.replace("{people}", "Alex Example" + copy.and + copy.missingPerson)));
    assert.ok(blocks(script)[0].paragraphs.some(p => p.kind === "cue" && p.spans.some(span => span.kind === "name")));
    const separated = build([a, item("between", "custom_program", { orderIndex: 1, content: "Break" }), { ...b, orderIndex: 2 }], locale);
    assert.deepEqual(blocks(separated).map(block => block.id), ["a", "between", "b"]);
    assert.equal(blocks(separated)[0].paragraphs.at(-1).kind, "spoken");
  });
  test(`${locale}: sacrament thanks follow passing, with explicit missing assignments`, () => {
    const copy = locale.startsWith("de") ? de : en;
    const passing = item("passing", "sacrament_passing", { section: "sacrament", personNameResolved: null });
    const script = build([item("blessing", "sacrament_blessing", { section: "sacrament" }), passing], locale);
    const pass = blocks(script).at(-1);
    assert.equal(pass.paragraphs.at(-2).kind, "cue");
    assert.equal(pass.paragraphs.at(-1).spans[0].text, copy.sacramentThanks);
    assert.ok(pass.paragraphs[0].spans.some(span => span.kind === "missing"));
    assert.ok(!words(build([item("blessing", "sacrament_blessing")], locale)).includes(copy.sacramentThanks));
  });
  test(`${locale}: child baptism has recognition without welcome vote; task details survive`, () => {
    const task = { type: "child_baptism", title: "Saved task title", description: "Saved task\ndetail" };
    const child = blocks(build([item("child", "member_welcome", { task })], locale))[0];
    assert.equal(child.paragraphs.some(p => p.kind === "cue"), false);
    assert.ok(child.paragraphs.some(p => p.kind === "spoken" && p.spans.some(span => span.text === task.description)));
    assert.equal(blocks(build([item("welcome", "member_welcome")], locale))[0].paragraphs.at(-1).kind, "cue");
  });
  test(`${locale}: every item type is covered without unresolved tokens`, () => {
    const script = build(SUNDAY_MEETING_ITEM_TYPES.map((type, index) => item(type, type, { orderIndex: index, content: "Saved detail" })), locale);
    assert.ok(!words(script).match(/\{\w+\}/));
    assert.ok(paragraphs(script).some(p => p.kind === "spoken" && p.spans.some(span => span.kind === "name" && span.text === "Alex Example")));
  });
}

test("unknown hymns, missing leader and unsupported language stay explicit", () => {
  const script = build([item("h", "hymn", { metadata: { hymnNumber: 9999 } })], "fr");
  assert.ok(script.notice);
  assert.ok(words(script).includes("9999"));
  assert.ok(words(script).includes(en.unknownHymn));
  assert.ok(words(script).includes(en.missingPerson));
});

test("nonlocal conferences do not generate a local ceremony", () => {
  for (const type of ["stake_conference", "general_conference"]) assert.equal(build([], "de", { type }).kind, "nonlocal");
});

test("all local types render and fast testimony includes invitation", () => {
  for (const type of ["sacrament", "ward_conference", "fast_testimony", "childrens_sacrament_presentation"]) {
    const script = build([], "en", { type });
    assert.equal(script.kind, "local");
    assert.equal(words(script).includes(en.testimony), type === "fast_testimony");
  }
});

for (const locale of ["en", "de"]) {
  test(`${locale}: grouped sacrament people and optional empty interlude`, () => {
    const script = build([
      item("first", "sacrament_passing", { section: "sacrament", orderIndex: 0 }),
      item("second", "sacrament_passing", { section: "sacrament", orderIndex: 1, personNameResolved: "Robin Example" }),
      item("interlude", "hymn", { slot: "interlude", personNameResolved: null }),
    ], locale);
    const passing = blocks(script).find(block => block.id === "first");
    assert.deepEqual(passing.paragraphs[0].spans.filter(span => span.kind === "name").map(span => span.text), ["Alex Example", "Robin Example"]);
    assert.equal(blocks(script).find(block => block.id === "interlude").paragraphs.length, 0);
  });
}
