import assert from "node:assert/strict";
import {
  SUNDAY_MEETING_ITEM_TYPES,
  SUNDAY_MEETING_SECTIONS,
} from "../types.ts";
import { addableAgendaItemTypes } from "../add-item-rules.ts";

export async function verifyAddItemPlacement(
  service,
  loadSundayMeeting,
  wardId,
) {
  const meeting = await service.createOrLoadSundayMeeting(
    wardId,
    "2026-10-11",
    "sacrament",
  );
  const expected = {
    opening: [
      "hymn",
      "prayer",
      "musical_number",
      "announcement",
      "conductor_text",
    ],
    business: [
      "member_welcome",
      "child_naming_blessing",
      "convert_confirmation",
      "ward_business",
      "conductor_text",
    ],
    sacrament: [
      "hymn",
      "sacrament_blessing",
      "sacrament_passing",
      "conductor_text",
    ],
    program: [
      "hymn",
      "musical_number",
      "talk",
      "primary_presentation",
      "custom_program",
      "transition",
      "conductor_text",
    ],
    closing: ["hymn", "prayer", "musical_number", "conductor_text"],
    participants: [],
  };
  const participantTypes = [
    "leader",
    "presiding",
    "organist",
    "music_conductor",
    "visitor",
  ];
  for (const section of SUNDAY_MEETING_SECTIONS) {
    assert.deepEqual(
      addableAgendaItemTypes(section).sort(),
      expected[section].toSorted(),
    );
    for (const type of SUNDAY_MEETING_ITEM_TYPES.filter(
      (type) => !participantTypes.includes(type),
    )) {
      const input = {
        type,
        section,
        content: type === "transition" ? null : "Placement check",
      };
      if (!expected[section].includes(type)) {
        const before = await loadSundayMeeting(wardId, meeting.id);
        await assert.rejects(service.addSundayItem(wardId, meeting.id, input));
        assert.deepEqual(
          (await loadSundayMeeting(wardId, meeting.id)).items,
          before.items,
        );
        continue;
      }
      const id = await service.addSundayItem(wardId, meeting.id, input);
      assert.equal(
        (await loadSundayMeeting(wardId, meeting.id)).items.find(
          (item) => item.id === id,
        ).section,
        section,
      );
      await service.deleteSundayItem(wardId, id);
    }
  }
  // Addition restrictions never constrain moving, editing, or loading extra items.
  const talk = await service.addSundayItem(wardId, meeting.id, {
    type: "talk",
    section: "program",
    content: "Original topic",
  });
  for (const section of Object.keys(expected).filter(
    (section) => section !== "participants",
  )) {
    await service.moveSundayItem(wardId, talk, {
      section,
      showSupportText: false,
    });
    await service.updateSundayItem(wardId, talk, {
      content: `Topic in ${section}`,
    });
    const saved = (await loadSundayMeeting(wardId, meeting.id)).items.find(
      (item) => item.id === talk,
    );
    assert.equal(saved.section, section);
    assert.equal(saved.content, `Topic in ${section}`);
  }
  // Participant creation continues through its separate controls.
  await service.addSundayItem(wardId, meeting.id, {
    type: "visitor",
    section: "participants",
    person: { personName: "Visitor" },
  });
}
