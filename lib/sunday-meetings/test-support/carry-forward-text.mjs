import assert from "node:assert/strict";

export async function verifyCarryForwardText(service, loadMeeting, wardId) {
  const source = await service.createOrLoadSundayMeeting(
    wardId,
    "2032-01-04",
    "sacrament",
  );
  await service.createOrLoadSundayMeeting(
    wardId,
    "2032-01-11",
    "stake_conference",
  );
  const destination = await service.createOrLoadSundayMeeting(
    wardId,
    "2032-01-18",
    "sacrament",
  );
  const input = {
    type: "conductor_text",
    section: "program",
    content: "First line\nSecond line",
  };
  const itemId = await service.addSundayItem(wardId, source.id, input);
  const blocker = await service.addSundayItem(wardId, destination.id, input);
  await assert.rejects(
    service.carryForwardItem(wardId, itemId),
    /cannot be adjacent/,
  );
  assert.ok(
    (await loadMeeting(wardId, source.id)).items.some(
      (item) => item.id === itemId,
    ),
  );
  await service.deleteSundayItem(wardId, blocker);
  assert.deepEqual(await service.carryForwardItem(wardId, itemId), {
    destinationDate: "2032-01-18",
  });
  assert.ok(
    !(await loadMeeting(wardId, source.id)).items.some(
      (item) => item.id === itemId,
    ),
  );
  const saved = (await loadMeeting(wardId, destination.id)).items
    .filter((item) => item.section === "program")
    .at(-1);
  assert.equal(saved.id, itemId);
  assert.equal(saved.content, input.content);
}
