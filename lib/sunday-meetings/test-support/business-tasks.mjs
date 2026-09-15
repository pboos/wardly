import assert from "node:assert/strict";

export async function verifyBusinessTasks(prisma, service, ward, otherWard) {
  const { addSuggestedTasksToMeeting, loadSundayMeetingTaskCandidates } =
    await import("../tasks.ts");
  const source = await service.createOrLoadSundayMeeting(
    ward.id,
    "2028-01-02",
    "sacrament",
  );
  const target = await service.createOrLoadSundayMeeting(
    ward.id,
    "2028-01-09",
    "sacrament",
  );
  const conference = await service.createOrLoadSundayMeeting(
    ward.id,
    "2028-01-16",
    "stake_conference",
  );
  const foreign = await service.createOrLoadSundayMeeting(
    otherWard.id,
    "2028-01-09",
    "sacrament",
  );
  const member = await prisma.member.create({
    data: {
      ward_id: ward.id,
      first_name: "Jane",
      last_name: "Smith",
      gender: "female",
      is_baptized: true,
    },
  });
  const make = (type, state = "in_front_of_ward", wardId = ward.id) =>
    prisma.task.create({
      data: {
        ward_id: wardId,
        type,
        state,
        title: type,
        ...(wardId === ward.id ? { member_id: member.id } : {}),
      },
    });
  const calling = await make("calling");
  const priesthood = await make("priesthood_aaronic");
  const invalid = await make("calling", "todo");
  const foreignTask = await make("calling", "in_front_of_ward", otherWard.id);
  const candidates = async () =>
    (await loadSundayMeetingTaskCandidates(ward.id)).flatMap(
      (group) => group.items,
    );
  assert.ok(
    !(await candidates()).some((task) =>
      [invalid.id, foreignTask.id].includes(task.id),
    ),
  );
  const [itemId] = await addSuggestedTasksToMeeting(ward.id, source.id, [
    calling.id,
  ]);
  await service.updateSundayItem(ward.id, itemId, {
    content: "Preserved wording",
  });
  assert.equal(
    (await candidates()).find((task) => task.id === calling.id).scheduledMeeting
      .id,
    source.id,
  );
  await assert.rejects(
    addSuggestedTasksToMeeting(ward.id, target.id, [calling.id, invalid.id]),
  );
  assert.equal(
    (await candidates()).find((task) => task.id === calling.id).scheduledMeeting
      .id,
    source.id,
  );
  await assert.rejects(
    addSuggestedTasksToMeeting(ward.id, conference.id, [calling.id]),
  );
  await assert.rejects(
    addSuggestedTasksToMeeting(ward.id, foreign.id, [calling.id]),
  );
  await assert.rejects(
    addSuggestedTasksToMeeting(ward.id, target.id, [foreignTask.id]),
  );
  const ids = await addSuggestedTasksToMeeting(ward.id, target.id, [
    calling.id,
    priesthood.id,
    priesthood.id,
  ]);
  assert.equal(ids.length, 2);
  assert.equal(ids[0], itemId);
  const rows = await prisma.sunday_meeting_item.findMany({
    where: { task_id: { in: [calling.id, priesthood.id] } },
    orderBy: { order_index: "asc" },
  });
  assert.deepEqual(
    rows.map((row) => row.type),
    ["calling_sustain", "priesthood_aaronic_inform"],
  );
  assert.ok(
    rows.every(
      (row) =>
        row.sunday_meeting_id === target.id && row.section === "business",
    ),
  );
  assert.equal(rows[0].content, "Preserved wording");
  assert.equal(
    await prisma.sunday_meeting_item.count({
      where: { sunday_meeting_id: source.id, task_id: calling.id },
    }),
    0,
  );
  assert.equal(
    (await prisma.task.findUnique({ where: { id: calling.id } })).state,
    "in_front_of_ward",
  );
  await assert.rejects(
    addSuggestedTasksToMeeting(ward.id, target.id, [calling.id]),
  );
  await assert.rejects(
    prisma.sunday_meeting_item.create({
      data: {
        sunday_meeting_id: source.id,
        task_id: calling.id,
        section: "business",
        type: "calling_sustain",
        order_index: 0,
      },
    }),
  );
  await service.deleteSundayItem(ward.id, itemId);
  assert.equal(
    (await candidates()).find((task) => task.id === calling.id)
      .scheduledMeeting,
    null,
  );
  await addSuggestedTasksToMeeting(ward.id, source.id, [calling.id]);
  await prisma.task.update({
    where: { id: calling.id },
    data: { state: "set_apart" },
  });
  assert.ok(!(await candidates()).some((task) => task.id === calling.id));
  assert.equal(
    await prisma.sunday_meeting_item.count({ where: { task_id: calling.id } }),
    1,
  );
  await assert.rejects(
    addSuggestedTasksToMeeting(ward.id, target.id, [calling.id]),
  );
  await service.carryForwardItem(ward.id, ids[1]);
  assert.equal(
    await prisma.sunday_meeting_item.count({
      where: { task_id: priesthood.id },
    }),
    1,
  );
  assert.equal(
    (await candidates()).find((task) => task.id === priesthood.id)
      .scheduledMeeting.date,
    "2028-01-23",
  );
  // Database lifecycle overrides take precedence over code defaults.
  await prisma.task_type_state.create({
    data: {
      ward_id: ward.id,
      task_type: "calling",
      state: "review",
      label: "Review",
      order_index: 0,
      sunday_meeting_item_type: "calling_release",
    },
  });
  await prisma.task.update({
    where: { id: calling.id },
    data: { state: "review" },
  });
  await addSuggestedTasksToMeeting(ward.id, target.id, [calling.id]);
  assert.equal(
    (
      await prisma.sunday_meeting_item.findFirst({
        where: { task_id: calling.id },
      })
    ).type,
    "calling_release",
  );
}
