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
      gender: "f",
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
  const childBaptism = await make("child_baptism");
  const childBlessing = await make("child_naming_blessing", "blessing");
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
    childBaptism.id,
    childBlessing.id,
  ]);
  assert.equal(ids.length, 4);
  assert.equal(ids[0], itemId);
  const rows = await prisma.sunday_meeting_item.findMany({
    where: {
      task_id: {
        in: [calling.id, priesthood.id, childBaptism.id, childBlessing.id],
      },
    },
    orderBy: { order_index: "asc" },
  });
  assert.deepEqual(
    rows.map((row) => row.type),
    [
      "calling_sustain",
      "priesthood_aaronic_inform",
      "member_welcome",
      "child_naming_blessing",
    ],
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
  await verifyLinkedTaskNames(prisma, service, ward, member);
  // Database lifecycle overrides take precedence over code defaults.
  const { loadLeadingSundayMeeting } = await import("../loaders.ts");
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
  const candidate = (await candidates()).find((task) => task.id === calling.id);
  assert.equal(candidate.typeLabel, "Calling");
  assert.equal(candidate.stateLabel, "Review");
  await addSuggestedTasksToMeeting(ward.id, target.id, [calling.id]);
  assert.equal(
    (
      await prisma.sunday_meeting_item.findFirst({
        where: { task_id: calling.id },
      })
    ).type,
    "calling_release",
  );
  const leading = await loadLeadingSundayMeeting(ward.id, target.date);
  const linked = leading.meeting.items.find(
    (item) => item.taskId === calling.id,
  );
  assert.equal(linked.task.typeLabel, "Calling");
  assert.equal(linked.task.stateLabel, "Review");
  await prisma.task.update({
    where: { id: calling.id },
    data: { state: "retired_state" },
  });
  const changed = await loadLeadingSundayMeeting(ward.id, target.date);
  assert.equal(
    changed.meeting.items.find((item) => item.taskId === calling.id).task
      .stateLabel,
    "retired_state",
  );
  assert.ok(
    !changed.taskCandidates
      .flatMap((group) => group.items)
      .some((task) => task.id === calling.id),
  );
}

async function verifyLinkedTaskNames(prisma, service, ward, member) {
  const { addSuggestedTasksToMeeting } = await import("../tasks.ts");
  const { loadSundayMeeting } = await import("../loaders.ts");
  const { buildLeadingScript } = await import("../leading-script.ts");
  const meeting = await service.createOrLoadSundayMeeting(ward.id, "2029-02-04", "sacrament");
  const tasks = await Promise.all(["calling", "calling_release"].map(type =>
    prisma.task.create({ data: {
      ward_id: ward.id, type, state: "in_front_of_ward",
      title: "Office", member_id: member.id,
    } }),
  ));
  const ids = await addSuggestedTasksToMeeting(ward.id, meeting.id, tasks.map(task => task.id));
  const check = async (expectedName) => {
    const loaded = await loadSundayMeeting(ward.id, meeting.id);
    for (const id of ids) {
      assert.equal(loaded.items.find(item => item.id === id).personNameResolved, expectedName);
    }
    for (const contentLocale of ["en", "de"]) {
      for (const mode of ["notes", "detailed"]) {
        const script = buildLeadingScript({ meeting: loaded, contentLocale, mode, hymns: [] });
        const rows = script.sections.flatMap(section => section.blocks)
          .flatMap(block => block.paragraphs)
          .filter(paragraph => paragraph.kind === "list")
          .flatMap(paragraph => paragraph.rows);
        assert.equal(rows.length, 2);
        for (const row of rows) {
          assert.ok(row.some(span => span.kind === "name" && span.text === expectedName));
          assert.ok(!row.some(span => span.kind === "missing"));
        }
      }
    }
  };
  await check("Jane Smith");
  const replacement = await prisma.member.create({ data: {
    ward_id: ward.id, first_name: "Robin", last_name: "Example", gender: "m", is_baptized: true,
  } });
  await prisma.task.updateMany({ where: { id: { in: tasks.map(task => task.id) } }, data: { member_id: replacement.id } });
  await check("Robin Example");
  await prisma.sunday_meeting_item.update({ where: { id: ids[0] }, data: { person_member_id: member.id } });
  await prisma.sunday_meeting_item.update({ where: { id: ids[1] }, data: { person_name: "Explicit person" } });
  const explicit = await loadSundayMeeting(ward.id, meeting.id);
  assert.equal(explicit.items.find(item => item.id === ids[0]).personNameResolved, "Jane Smith");
  assert.equal(explicit.items.find(item => item.id === ids[1]).personNameResolved, "Explicit person");
  await prisma.sunday_meeting_item.updateMany({ where: { id: { in: ids } }, data: { person_member_id: null, person_name: null } });
  await prisma.task.updateMany({ where: { id: { in: tasks.map(task => task.id) } }, data: { member_id: null } });
  const empty = await loadSundayMeeting(ward.id, meeting.id);
  assert.ok(empty.items.filter(item => ids.includes(item.id)).every(item => item.personNameResolved === null));
}
