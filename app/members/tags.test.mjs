import assert from "node:assert/strict";
import test from "node:test";
import { matchesTags, validateTag, excludedTagIds } from "./tags.ts";

test("tag filters require all included tags and reject any excluded tag", () => {
  assert.equal(matchesTags(["a"], ["a", "b"], []), false);
  assert.equal(matchesTags(["a", "b", "c"], ["a", "b"], []), true);
  assert.equal(matchesTags(["a", "b"], ["a"], ["b", "c"]), false);
  assert.equal(matchesTags([], [], []), true);
  assert.equal(matchesTags([], ["a"], []), false);
});
test("tag names normalize whitespace and case; colors and length are validated", () => {
  assert.deepEqual(validateTag("  No   Contact ", "blue"), {
    name: "No Contact",
    normalized_name: "no contact",
    color: "blue",
  });
  for (const name of [" ", "a".repeat(41), null])
    assert.throws(() => validateTag(name, "blue"));
  assert.throws(() => validateTag("Focus", "invalid"));
});

test("default exclusions follow refreshed tags while manual overrides persist", () => {
  const tags = [
    { id: "a", isDefaultExcluded: true },
    { id: "b", isDefaultExcluded: false },
  ];
  assert.deepEqual(excludedTagIds(tags, {}), ["a"]);
  assert.deepEqual(excludedTagIds(tags, { a: false, b: true }), ["b"]);
  assert.deepEqual(
    excludedTagIds(
      tags.map((tag) => ({ ...tag, isDefaultExcluded: true })),
      { a: false },
    ),
    ["b"],
  );
  assert.deepEqual(excludedTagIds(tags.slice(1), { a: true }), []);
  assert.equal(matchesTags(["a", "b"], [], excludedTagIds(tags, {})), false);
});
