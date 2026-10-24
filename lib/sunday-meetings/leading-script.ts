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
  const cue = (
    key: ScriptCopyKey,
    values: Readonly<Record<string, readonly ScriptSpan[]>> = {},
  ): ScriptParagraph => ({ kind: "cue", spans: expandCopy(copy[key], values) });
  const literal = (value: string): ScriptParagraph => ({ kind: "spoken", spans: text(value) });
  const details = (items: readonly SundayMeetingItem[]): ScriptParagraph[] => items.flatMap(item =>
    [...new Set([item.content, item.task?.title, item.task?.description].filter((value): value is string => !!value))].map(literal),
  );
  const hymn = (item: SundayMeetingItem): ScriptSpan[] => {
    const number = item.metadata?.hymnNumber;
    if (!number) return missing(copy.missingHymn);
    const title = hymns.find(entry => entry.number === number)?.title;
    return expandCopy(copy.hymnName, { number: text(String(number)), title: title ? text(title) : missing(copy.unknownHymn) });
  };
  const introduction: ScriptParagraph[] = [spoken(meeting.type === "fast_testimony" ? "fastGreeting" : "greeting")];
  for (const role of ["presiding", "leader", "visitor", "organist", "music_conductor"] as const) {
    const assigned = meeting.items.filter(item => item.section === "participants" && item.type === role);
    if (assigned.length || role === "leader") {
      introduction.push(spoken(role, { people: assigned.length ? people(assigned) : missing(copy.missingPerson) }), ...details(assigned));
    }
  }
  if (meeting.information) introduction.push(literal(meeting.information));
  const rows = buildAgendaRows(meeting, true);
  const rowParagraphs = (row: SundayAgendaRow, prayerAlreadyAnnounced: boolean): ScriptParagraph[] => {
    const { item } = row;
    const values = { people: people(row.people) };
    const saved = details(row.people);
    switch (item.type) {
      case "hymn":
        if (item.slot === "interlude" && !item.metadata?.hymnNumber && !item.content) return [];
        return [
          spoken(
            item.slot === "sacrament_hymn" ? "sacramentHymn"
              : item.slot === "closing_hymn" ? "closingHymn" : "hymn",
            { hymn: hymn(item) },
          ),
          ...saved,
          cue("hymnCue"),
        ];
      case "prayer":
        return [
          ...(prayerAlreadyAnnounced ? [] : [spoken("prayer", values)]),
          ...saved, cue("prayerCue"), spoken("prayerThanks", values),
        ];
      case "sacrament_blessing":
        return [spoken(item.type, values), ...saved, cue("blessingCue")];
      case "sacrament_passing":
        return [spoken(item.type, values), ...saved, cue("passingCue"), spoken("sacramentThanks")];
      case "musical_number":
        return [spoken(item.type, values), ...saved, cue("musicCue"), spoken("musicThanks", values)];
      case "primary_presentation":
        return [spoken(item.type), ...saved, cue("presentationCue"), spoken("presentationThanks")];
      case "calling_sustain":
      case "calling_release":
      case "priesthood_aaronic_inform": {
        const detail = item.content || item.task?.title;
        const paragraphs = [spoken(item.type, { ...values, detail: detail ? text(detail) : missing(copy.missingDetail) })];
        for (const value of [...new Set([item.content, item.task?.title, item.task?.description])]) {
          if (value && value !== detail) paragraphs.push(literal(value));
        }
        if (item.type !== "priesthood_aaronic_inform") paragraphs.push(cue("voteCue"));
        if (item.type === "calling_sustain") paragraphs.push(spoken("opposed"), cue("voteCue"));
        return paragraphs;
      }
      case "member_welcome":
        return [
          spoken(item.task?.type === "child_baptism" ? "childBaptism" : "member_welcome", values),
          ...saved,
          ...(item.task?.type === "child_baptism" ? [] : [cue("voteCue")]),
        ];
      case "convert_confirmation":
        return [spoken(item.type, values), ...saved, cue("confirmationCue")];
      case "child_naming_blessing":
        return [spoken(item.type, values), ...saved, cue("childBlessingCue")];
      case "transition":
        return [...saved, cue("transition")];
      case "announcement":
      case "ward_business":
      case "custom_program":
      case "conductor_text":
        return [
          ...(item.personNameResolved ? [{ kind: "spoken" as const, spans: people(row.people) }] : []),
          ...saved,
        ];
      case "talk":
        return [];
      case "leader":
      case "organist":
      case "music_conductor":
      case "visitor":
      case "presiding":
        return [spoken(item.type, values), ...saved];
      default: { const exhaustive: never = item.type; return exhaustive; }
    }
  };
  const sections = AGENDA_SECTIONS.map(section => {
    const sectionRows = rows.filter(row => row.item.section === section);
    const blocks: LeadingBlock[] = [];
    let announcedPrayer: string | null = null;
    for (let index = 0; index < sectionRows.length; index++) {
      const row = sectionRows[index];
      if (!row) continue;
      const next = sectionRows[index + 1];
      if (row.item.type === "talk") {
        const run = [row];
        while (sectionRows[index + 1]?.item.type === "talk") {
          const following = sectionRows[++index];
          if (following) run.push(following);
        }
        const speakers = run.flatMap(entry => entry.people);
        const plural = speakers.length > 1;
        blocks.push({
          id: row.item.id,
          paragraphs: [
            spoken(plural ? "talks" : "talk", { people: people(speakers) }),
            ...run.flatMap(entry => [
              ...details(entry.people), cue("talkCue", { people: people(entry.people) }),
            ]),
            spoken(plural ? "talksThanks" : "talkThanks", { people: people(speakers) }),
          ],
        });
      } else if (
        row.item.type === "hymn"
        && (row.item.slot === "opening_hymn" || row.item.slot === "closing_hymn")
        && next?.item.type === "prayer"
        && next.item.slot === (row.item.slot === "opening_hymn" ? "opening_prayer" : "closing_prayer")
      ) {
        blocks.push({
          id: row.item.id,
          paragraphs: [
            spoken(row.item.slot === "closing_hymn" ? "closingPair" : "pair", {
              hymn: hymn(row.item), people: people(next.people),
            }),
            ...details(row.people), cue("hymnCue"),
          ],
        });
        announcedPrayer = next.item.id;
      } else {
        blocks.push({ id: row.item.id, paragraphs: rowParagraphs(row, announcedPrayer === row.item.id) });
        announcedPrayer = null;
      }
    }
    if (section === "program" && meeting.type === "fast_testimony") {
      blocks.push({
        id: "testimony",
        paragraphs: [spoken("testimony"), cue("testimonyCue"), spoken("testimonyThanks")],
      });
    }
    return { section, title: copy[section], blocks };
  });
  return { ...common, kind: "local", introduction, sections };
}
