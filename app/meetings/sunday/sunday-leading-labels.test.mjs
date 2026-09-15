import assert from "node:assert/strict";
import test from "node:test";
import { SUNDAY_MEETING_SECTIONS } from "@/lib/sunday-meetings/types";
import { SECTION_LABELS } from "./sunday-leading-labels";

test("SECTION_LABELS covers every meeting section with a nice name", () => {
  assert.deepEqual(
    Object.keys(SECTION_LABELS).sort(),
    [...SUNDAY_MEETING_SECTIONS].sort(),
  );

  for (const section of SUNDAY_MEETING_SECTIONS) {
    const label = SECTION_LABELS[section];
    assert.equal(typeof label, "string", `${section} must have a label`);
    assert.ok(label.trim().length > 0, `${section} must have a non-empty label`);
    assert.ok(
      !label.includes("_"),
      `${section} must have a nice name, not the raw enum: ${label}`,
    );
  }
});
