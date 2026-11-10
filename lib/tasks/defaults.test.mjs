import assert from "node:assert/strict";
import test from "node:test";

import { DEFAULT_TASK_TYPES } from "./defaults.ts";

const expectedTypes = {
  temple_endowment_living: [
    "Bishop interview",
    "Submit to stake",
    "Stake interview",
    "Submitted to temple",
    "Done",
  ],
  temple_sealing_living: [
    "Bishop interview",
    "Submit to stake",
    "Stake interview",
    "Submitted to temple",
    "Done",
  ],
  patriarchal_blessing_recommend: [
    "Bishop interview",
    "Submit in system",
    "Patriarchal blessing",
    "Done",
  ],
  child_baptism: [
    "Interview",
    "Baptism & confirmation",
    "In front of ward",
    "Record in LCR",
    "Certificate",
    "Done",
  ],
  child_naming_blessing: [
    "Prepare child record form",
    "Blessing",
    "Create membership record",
    "Done",
  ],
  missionary_recommendation: [
    "Candidate preparation",
    "Bishop interview",
    "Submit to stake",
    "Stake interview",
    "Confirm submitted by stake",
    "Done",
  ],
};

test("new automatic task types have their configured lifecycles", () => {
  for (const [type, labels] of Object.entries(expectedTypes)) {
    const definition = DEFAULT_TASK_TYPES.find((item) => item.type === type);
    assert.ok(definition, `${type} should be defined`);
    assert.equal(definition.enabled, true);
    assert.equal(definition.source, "default");
    assert.deepEqual(
      definition.states.map((state) => state.label),
      labels,
    );
    assert.equal(definition.states[0].state_group, "not_started");
    assert.equal(definition.states.at(-1).state_group, "closed");
  }
});

test("child ordinance presentation states map to existing agenda items", () => {
  const baptism = DEFAULT_TASK_TYPES.find(
    (item) => item.type === "child_baptism",
  );
  const blessing = DEFAULT_TASK_TYPES.find(
    (item) => item.type === "child_naming_blessing",
  );

  assert.equal(
    baptism.states.find((state) => state.state === "in_front_of_ward")
      .sunday_meeting_item_type,
    "member_welcome",
  );
  assert.equal(
    blessing.states.find((state) => state.state === "blessing")
      .sunday_meeting_item_type,
    "child_naming_blessing",
  );
});

test("adult Aaronic Priesthood sustains in ward business before ordination", () => {
  const original = DEFAULT_TASK_TYPES.find(
    (item) => item.type === "priesthood_aaronic",
  );
  const adult = DEFAULT_TASK_TYPES.find(
    (item) => item.type === "priesthood_aaronic_adult",
  );

  assert.ok(original);
  assert.deepEqual(
    original.states.map(({ label }) => label),
    [
      "Interview",
      "Sustain in front of quorum",
      "(Confer &) Ordain",
      "Record in LCR",
      "In front of ward",
      "Done",
    ],
  );
  assert.ok(adult);
  assert.equal(adult.name, "Aaronic Priesthood (Adult)");
  assert.equal(adult.enabled, true);
  assert.equal(adult.source, "default");
  assert.deepEqual(adult.configuration, original.configuration);
  assert.deepEqual(
    adult.states.map(({ state, label, state_group, sunday_meeting_item_type }) => [
      state,
      label,
      state_group,
      sunday_meeting_item_type,
    ]),
    [
      ["todo", "Interview", "not_started", null],
      ["sustain", "Sustain in front of ward", "active", "calling_sustain"],
      ["confer_ordain", "Confer & Ordain", "active", null],
      ["record", "Record in LCR", "active", null],
      ["done", "Done", "closed", null],
    ],
  );
});
