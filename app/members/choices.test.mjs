import assert from "node:assert/strict";
import test from "node:test";
import { groupedMemberChoices } from "../../lib/members/choices.ts";

test("member choices group exclusions, prioritize exact names within groups, and preserve duplicate IDs", () => {
  const items = [
    {
      value: "excluded",
      label: "Alice",
      exclusionTags: [{ id: "tag", name: "Unknown", color: "gray" }],
    },
    { value: "partial", label: "Alice Adams" },
    { value: "exact", label: "Alice" },
    { value: "duplicate", label: "Alice" },
  ];
  const groups = groupedMemberChoices(items, " ALICE ");
  assert.deepEqual(
    groups.regular.map((item) => item.value),
    ["exact", "duplicate", "partial"],
  );
  assert.deepEqual(
    groups.excluded.map((item) => item.value),
    ["excluded"],
  );
  assert.deepEqual(groupedMemberChoices(items, "zzz"), {
    regular: [],
    excluded: [],
  });
  assert.equal(groupedMemberChoices(items, "Alice", 1).excluded.length, 1);
});
