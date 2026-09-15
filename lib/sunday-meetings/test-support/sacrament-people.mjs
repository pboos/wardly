import assert from "node:assert/strict";
import { loadSundayMeeting } from "../loaders.ts";
import { buildAgendaRows } from "../agenda.ts";

export async function verifySacramentPeople(prisma, service, ward, otherWard) {
  const meeting = await service.createOrLoadSundayMeeting(
    ward.id,
    "2027-03-14",
    "sacrament",
  );
  const load = () => loadSundayMeeting(ward.id, meeting.id);
  let current = await load();
  const blessing = current.items.find(
    (item) => item.slot === "sacrament_blessing",
  );
  const passing = current.items.find(
    (item) => item.slot === "sacrament_passing",
  );
  await service.addSacramentPerson(ward.id, blessing.id, {
    personName: "First",
  });
  await service.addSacramentPerson(ward.id, blessing.id, {
    personName: "Second",
  });
  await assert.rejects(
    service.addSacramentPerson(ward.id, blessing.id, { personName: "Third" }),
    /at most two/,
  );
  await assert.rejects(
    service.addSundayItem(ward.id, meeting.id, {
      type: "sacrament_blessing",
      section: "sacrament",
      person: { personName: "Bypass" },
    }),
    /at most two/,
  );
  await assert.rejects(
    service.addSacramentPerson(otherWard.id, passing.id, {
      personName: "Foreign",
    }),
    /not found/,
  );
  for (let index = 0; index < 13; index++) {
    await service.addSacramentPerson(ward.id, passing.id, {
      personName: `Passer ${index}`,
    });
  }
  current = await load();
  const rows = buildAgendaRows(current);
  assert.equal(
    rows.filter((row) => row.item.type === "sacrament_blessing").length,
    1,
  );
  assert.equal(
    rows.find((row) => row.item.id === blessing.id).people.length,
    2,
  );
  assert.equal(
    rows.find((row) => row.item.id === passing.id).people.length,
    13,
  );
  for (const showSupportText of [true, false]) {
    await service.moveSundayItem(ward.id, passing.id, {
      direction: "up",
      showSupportText,
    });
    current = await load();
    const types = current.items
      .filter((item) => item.section === "sacrament")
      .map((item) => item.type);
    assert.equal(
      types.indexOf("sacrament_blessing") - types.indexOf("sacrament_passing"),
      13,
    );
    await service.moveSundayItem(ward.id, passing.id, {
      direction: "down",
      showSupportText,
    });
  }
  await service.updateSundayItem(ward.id, blessing.id, { person: null });
  await service.addSacramentPerson(ward.id, blessing.id, {
    personName: "Replacement",
  });
  current = await load();
  assert.equal(
    current.items.find((item) => item.id === blessing.id).personNameResolved,
    "Replacement",
  );
  const extra = current.items.find(
    (item) => item.type === "sacrament_blessing" && !item.slot,
  );
  await service.updateSundayItem(ward.id, extra.id, { person: null });
  current = await load();
  assert.ok(!current.items.some((item) => item.id === extra.id));
  await service.addSacramentPerson(ward.id, blessing.id, {
    personName: "New second",
  });
  assert.equal(
    (await load()).items.filter((item) => item.type === "sacrament_blessing")
      .length,
    2,
  );
  await prisma.sunday_meeting.delete({ where: { id: meeting.id } });
}
