import assert from "node:assert/strict";
import test from "node:test";
import { groupMembersByHousehold } from "./households.ts";

const member = (
  id,
  last_name,
  household = null,
  role = null,
  birth_date = null,
) => ({
  id,
  birth_date,
  first_name: id,
  last_name,
  external_household_uuid: household,
  external_household_role: role,
});

test("households keep different surnames together with the head first", () => {
  const members = [
    member("child", "Adams", "family", "CHILD"),
    member("single", "Brown"),
    member("head", "Smith", "family", " head "),
    member("spouse", "Jones", "family", "SPOUSE"),
  ];
  const groups = groupMembersByHousehold(members);
  assert.deepEqual(
    groups.map((g) => g.members.map((m) => m.id)),
    [["single"], ["head", "child", "spouse"]],
  );
  assert.equal(members[0].id, "child", "does not reorder the input");
});

test("missing household IDs stay separate and unknown roles sort alphabetically", () => {
  const groups = groupMembersByHousehold([
    member("b", "Smith", "family", "UNKNOWN"),
    member("a", "Smith", "family"),
    member("c", "Smith"),
    member("d", "Smith", " "),
  ]);
  assert.deepEqual(
    groups.map((g) => g.members.map((m) => m.id)),
    [["a", "b"], ["c"], ["d"]],
  );
  assert.deepEqual(
    groups.map((g) => g.isHousehold),
    [true, false, false],
  );
  assert.deepEqual(groupMembersByHousehold([]), []);
});

test("oldest known member leads a household without a recorded head", () => {
  const members = [
    member("unknown", "Adams", "family"),
    member("young", "Brown", "family", "CHILD", "2000-01-01"),
    member("oldest", "Smith", "family", "SPOUSE", "1970-01-01"),
    member("middle", "Clark", "family", null, "1990-01-01"),
  ];
  const [group] = groupMembersByHousehold(members);
  assert.equal(group.displayHeadId, "oldest");
  assert.deepEqual(
    group.members.map((m) => m.id),
    ["oldest", "unknown", "young", "middle"],
  );
  assert.equal(members[2].external_household_role, "SPOUSE");
});

test("recorded head takes precedence over an older household member", () => {
  const [group] = groupMembersByHousehold([
    member("older", "Adams", "family", "SPOUSE", "1960-01-01"),
    member("head", "Smith", "family", "HEAD", "1970-01-01"),
  ]);
  assert.equal(group.displayHeadId, "head");
  assert.equal(group.members[0].id, "head");
});

test("tied and missing birth dates use alphabetical fallback", () => {
  for (const birthDate of [null, "1970-01-01"]) {
    const [group] = groupMembersByHousehold([
      member("z", "Smith", "family", null, birthDate),
      member("a", "Smith", "family", null, birthDate),
    ]);
    assert.equal(group.displayHeadId, "a");
    assert.equal(group.members[0].id, "a");
  }
});
