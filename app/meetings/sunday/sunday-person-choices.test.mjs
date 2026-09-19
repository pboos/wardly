import assert from "node:assert/strict";
import test from "node:test";
import { sundayPersonChoices } from "./sunday-person-choices.ts";

const members = [
  { id: "alice", name: "Alice Adams" },
  { id: "bob", name: "Bob Baker" },
];

test("partial member names offer a member first and an explicit free-text alternative", () => {
  const choices = sundayPersonChoices(members, "  ALIce ");
  assert.deepEqual(
    choices.map((choice) => choice.person),
    [
      { memberId: "alice", personName: null },
      { memberId: null, personName: "ALIce" },
    ],
  );
});

test("no match offers the trimmed non-member name; blank text never creates a person", () => {
  assert.deepEqual(
    sundayPersonChoices(members, "  Some visitor  ").map(
      (choice) => choice.person,
    ),
    [{ memberId: null, personName: "Some visitor" }],
  );
  assert.equal(sundayPersonChoices([], "  ").length, 0);
  assert.ok(
    sundayPersonChoices(members, "").every((choice) => choice.person.memberId),
  );
});

test("an exact member name is not silently offered as a non-member", () => {
  assert.deepEqual(
    sundayPersonChoices(members, "alice adams").map((choice) => choice.person),
    [{ memberId: "alice", personName: null }],
  );
});

test("an exact match takes priority beyond the visible suggestion limit", () => {
  const many = Array.from({ length: 10 }, (_, i) => ({
    id: `partial-${i}`,
    name: `Alice Adams ${i}`,
  }));
  const choices = sundayPersonChoices([...many, members[0]], "Alice Adams");
  assert.equal(choices[0].person.memberId, "alice");
  assert.equal(choices.length, 8);
});

test("excluded exact matches follow regular partial matches and remain selectable beyond the regular limit", () => {
  const excluded = {
    id: "excluded",
    name: "Alice Adams",
    exclusionTags: [{ id: "no-contact", name: "No contact", color: "gray" }],
  };
  const regular = Array.from({ length: 10 }, (_, i) => ({
    id: `regular-${i}`,
    name: `Alice Adams ${i}`,
  }));
  const choices = sundayPersonChoices([excluded, ...regular], "Alice Adams");
  assert.equal(choices.length, 9);
  assert.equal(choices.at(-1).person.memberId, "excluded");
  assert.equal(
    sundayPersonChoices([excluded], "Alice Adams")[0].person.memberId,
    "excluded",
  );
});
