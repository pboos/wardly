import type { Hymn } from "../hymns/index.ts";
import { AGENDA_SECTIONS, buildAgendaRows, type SundayAgendaRow } from "./agenda.ts";
import { expandCopy, leadingCopy, type ScriptCopyKey, type ScriptParagraph, type ScriptSpan } from "./leading-copy.ts";
import { isLocalMeetingType, type SundayMeeting, type SundayMeetingItem } from "./types.ts";

export type { ScriptParagraph, ScriptSpan } from "./leading-copy.ts";
export type LeadingBlock = { id: string; paragraphs: ScriptParagraph[] };
export type LeadingScript = {
  title: string;
  editLabel: string;
  locale: string;
  notice: string | null;
} & (
  | { kind: "nonlocal"; message: string }
  | { kind: "local"; introduction: ScriptParagraph[]; sections: { section: string; title: string; blocks: LeadingBlock[] }[] }
);

export function buildLeadingScript({ meeting, contentLocale, hymns }: {
  meeting: SundayMeeting;
  contentLocale: string;
  hymns: readonly Hymn[];
}): LeadingScript {
  const { copy, locale, fallback } = leadingCopy(contentLocale);
  const common = { title: copy[`${meeting.type}Title`], editLabel: copy.edit, locale, notice: fallback ? copy.fallback : null };
  if (!isLocalMeetingType(meeting.type)) return { ...common, kind: "nonlocal", message: copy.nonlocal };

  const text = (value: string): ScriptSpan[] => [{ kind: "text", text: value }];
  const missing = (value: string): ScriptSpan[] => [{ kind: "missing", text: value }];
  const people = (items: readonly SundayMeetingItem[]): ScriptSpan[] => items.flatMap((item, index) => [
    ...(index ? text(index === items.length - 1 ? copy.and : ", ") : []),
    ...(item.personNameResolved ? [{ kind: "name" as const, text: item.personNameResolved }] : missing(copy.missingPerson)),
  ]);
  const spoken = (
    key: ScriptCopyKey,
    values: Readonly<Record<string, readonly ScriptSpan[]>> = {},
  ): ScriptParagraph => ({ kind: "spoken", spans: expandCopy(copy[key], values) });
  const heading = (key: ScriptCopyKey): ScriptParagraph => ({ kind: "heading", spans: text(copy[key]) });
  const literal = (value: string): ScriptParagraph => ({ kind: "spoken", spans: text(value) });
  const details = (items: readonly SundayMeetingItem[]): ScriptParagraph[] => items.flatMap(item =>
    [...new Set([item.content, item.task?.title, item.task?.description].filter((value): value is string => !!value))].map(literal),
  );
  const hymnValues = (item: SundayMeetingItem) => {
    const number = item.metadata?.hymnNumber;
    const title = hymns.find(entry => entry.number === number)?.title;
    return {
      number: number ? text(String(number)) : missing(copy.missingHymn),
      title: title ? text(title) : missing(copy.unknownHymn),
    };
  };
  const hymn = (item: SundayMeetingItem): ScriptSpan[] => item.metadata?.hymnNumber
    ? expandCopy(copy.hymnName, hymnValues(item)) : missing(copy.missingHymn);
  const assigned = (role: SundayMeetingItem["type"]) => meeting.items.filter(item =>
    item.section === "participants" && item.type === role,
  );
  const introduction: ScriptParagraph[] = [{
    kind: "list",
    rows: (["presiding", "leader"] as const).filter(role => role === "leader" || assigned(role).length > 0).map(role => expandCopy(copy[role], {
      people: assigned(role).length ? people(assigned(role)) : missing(copy.missingPerson),
    })),
  }, spoken(meeting.type === "fast_testimony" ? "fastGreeting" : "greeting")];
  const visitors = assigned("visitor");
  if (visitors.length) {
    introduction.push(heading("visitor"), {
      kind: "list",
      rows: visitors.map(item => [...people([item]), ...(item.content ? text(`, ${item.content}`) : [])]),
    });
  }
  if (meeting.information) introduction.push(literal(meeting.information));
  const musicThanks: ScriptParagraph[] = [];
  for (const role of ["organist", "music_conductor"] as const) {
    const musicians = assigned(role).filter(item => item.personNameResolved);
    if (musicians.length) {
      musicThanks.push(spoken(role, { people: people(musicians) }));
    }
  }

  const rows = buildAgendaRows(meeting, true);
  const rowParagraphs = (row: SundayAgendaRow, prayerAlreadyAnnounced: boolean): ScriptParagraph[] => {
    const { item } = row;
    const values = { people: people(row.people) };
    const saved = details(row.people);
    switch (item.type) {
      case "hymn":
        if (item.slot === "interlude" || item.section === "program") {
          if (item.slot === "interlude" && !item.metadata?.hymnNumber && !item.content) return [];
          return [spoken("intermediateHymn", hymnValues(item))];
        }
        return [spoken(item.slot === "sacrament_hymn" ? "sacramentHymn"
          : item.slot === "closing_hymn" ? "closingHymn" : "hymn", { hymn: hymn(item) }), ...saved];
      case "prayer":
        return [
          ...(prayerAlreadyAnnounced ? [] : [spoken("prayer", values)]), ...saved,
          ...(item.slot === "closing_prayer" || item.section === "closing" ? [] : [spoken("prayerThanks", values)]),
        ];
      case "sacrament_blessing":
        return [];
      case "sacrament_passing":
        return [spoken("sacramentThanks")];
      case "musical_number": {
        const detail = item.content || item.task?.title;
        const performers = row.people.filter(person => person.personNameResolved);
        return [{
          kind: "spoken",
          spans: [
            ...expandCopy(copy.musical_number, { detail: detail ? text(detail) : performers.length ? people(performers) : missing(copy.missingDetail) }),
            ...(detail && performers.length ? [...text(", "), ...people(performers)] : []),
          ],
        }, ...(performers.length ? [spoken("musicThanks", { people: people(performers) })] : [])];
      }
      case "primary_presentation":
        return [spoken(item.type), ...saved, spoken("presentationThanks")];
      case "priesthood_aaronic_inform": {
        const detail = item.content || item.task?.title;
        return [
          spoken(item.type, { ...values, detail: detail ? text(detail) : missing(copy.missingDetail) }),
          ...saved.filter(paragraph => paragraph.kind !== "spoken" || paragraph.spans.map(span => span.text).join("") !== detail),
        ];
      }
      case "member_welcome":
        return [spoken(item.task?.type === "child_baptism" ? "childBaptism" : "member_welcome", values), ...saved];
      case "convert_confirmation":
      case "child_naming_blessing":
        return [spoken(item.type, values), ...saved];
      case "transition":
        return [...saved, { kind: "rule" }];
      case "announcement":
      case "ward_business":
      case "custom_program":
      case "conductor_text":
        return [...(item.personNameResolved ? [{ kind: "spoken" as const, spans: people(row.people) }] : []), ...saved];
      case "talk":
        return [spoken("talk", values)];
      case "calling_sustain":
      case "calling_release":
        return [];
      case "leader":
      case "presiding":
        return [spoken(item.type, values), ...saved];
      case "organist":
      case "music_conductor":
      case "visitor":
        return saved;
      default: { const exhaustive: never = item.type; return exhaustive; }
    }
  };
  const isCalling = (row: SundayAgendaRow | undefined) =>
    row?.item.type === "calling_release" || row?.item.type === "calling_sustain";
  let thankedMusicians = false;
  const sections = AGENDA_SECTIONS.map(section => {
    const sectionRows = rows.filter(row => row.item.section === section);
    const blocks: LeadingBlock[] = [];
    const thanksIndex = section === "closing"
      ? Math.max(0, sectionRows.findIndex(row => row.item.type === "hymn" || row.item.type === "prayer")) : -1;
    let announcedPrayer: string | null = null;
    for (let index = 0; index < sectionRows.length; index++) {
      const row = sectionRows[index];
      if (!row) continue;
      if (!thankedMusicians && (index === thanksIndex || row.item.slot === "closing_hymn" || row.item.slot === "closing_prayer")) {
        if (musicThanks.length) blocks.push({ id: "musician-thanks", paragraphs: musicThanks });
        thankedMusicians = true;
      }
      const next = sectionRows[index + 1];
      if (isCalling(row)) {
        const run = [row];
        while (isCalling(sectionRows[index + 1])) {
          const following = sectionRows[++index];
          if (following) run.push(following);
        }
        const paragraphs: ScriptParagraph[] = [];
        for (const type of ["calling_release", "calling_sustain"] as const) {
          const callings = run.filter(entry => entry.item.type === type);
          if (!callings.length) continue;
          paragraphs.push(heading(type === "calling_release" ? "releaseHeading" : "sustainHeading"), spoken(type), {
            kind: "list",
            rows: callings.flatMap(entry => entry.people.map(person => [
              ...people([person]), ...text(": "),
              ...(person.content || person.task?.title ? text(person.content || person.task?.title || "") : missing(copy.missingDetail)),
            ])),
          }, spoken(type === "calling_release" ? "releaseVote" : "sustainVote"));
          if (type === "calling_sustain") paragraphs.push(spoken("opposed"), spoken("voteThanks"));
        }
        blocks.push({ id: row.item.id, paragraphs });
      } else if (row.item.type === "talk") {
        const run = [row];
        while (sectionRows[index + 1]?.item.type === "talk") {
          const following = sectionRows[++index];
          if (following) run.push(following);
        }
        const speakers = run.flatMap(entry => entry.people);
        blocks.push({ id: row.item.id, paragraphs: [
          ...run.map(entry => spoken("talk", { people: people(entry.people) })),
          spoken(speakers.length > 1 ? "talksThanks" : "talkThanks", { people: people(speakers) }),
        ] });
      } else if (row.item.type === "hymn"
        && (row.item.slot === "opening_hymn" || row.item.slot === "closing_hymn")
        && next?.item.type === "prayer"
        && next.item.slot === (row.item.slot === "opening_hymn" ? "opening_prayer" : "closing_prayer")) {
        blocks.push({ id: row.item.id, paragraphs: [
          spoken(row.item.slot === "closing_hymn" ? "closingPair" : "pair", { hymn: hymn(row.item), people: people(next.people) }),
          ...details(row.people),
        ] });
        announcedPrayer = next.item.id;
      } else {
        blocks.push({ id: row.item.id, paragraphs: [
          ...(row.item.type === "announcement" && sectionRows[index - 1]?.item.type !== "announcement" ? [heading("announcements")] : []),
          ...rowParagraphs(row, announcedPrayer === row.item.id),
        ] });
        announcedPrayer = null;
      }
    }
    if (section === "program" && meeting.type === "fast_testimony") {
      blocks.push({ id: "testimony", paragraphs: [spoken("testimony"), spoken("testimonyThanks")] });
    }
    if (section === "closing" && !thankedMusicians && musicThanks.length) {
      blocks.unshift({ id: "musician-thanks", paragraphs: musicThanks });
      thankedMusicians = true;
    }
    return { section, title: copy[section], blocks: blocks.filter(block => block.paragraphs.length > 0) };
  });
  return { ...common, kind: "local", introduction, sections };
}
