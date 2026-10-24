import test from "node:test";
import assert from "node:assert/strict";
import { acknowledgeNoteDraft, receiveNoteDraft } from "./note-draft.ts";

const clean = (value) => ({ value, saved: value, received: value });

test("a clean reopened note accepts a delayed save refresh", () => {
  assert.deepEqual(receiveNoteDraft(clean(""), "Saved notes"), clean("Saved notes"));
});

test("refresh updates the clean scope without replacing another scope's edits or conflict baseline", () => {
  const meeting = { ...clean("Original"), value: "My edits" };
  const refreshed = receiveNoteDraft(meeting, "Another user's changes");
  assert.equal(refreshed.value, "My edits");
  assert.equal(refreshed.saved, "Original");
  assert.equal(refreshed.received, "Another user's changes");
  assert.equal(receiveNoteDraft(refreshed, refreshed.received), refreshed);
  assert.deepEqual(receiveNoteDraft(clean("Shared"), "Updated shared"), clean("Updated shared"));
});

test("save acknowledgment survives unchanged stale props and the eventual refresh", () => {
  const draft = { ...clean("Old"), value: " Saved " };
  const saved = acknowledgeNoteDraft(draft, draft.value);
  assert.equal(receiveNoteDraft(saved, "Old"), saved);
  assert.deepEqual(receiveNoteDraft(saved, "Saved"), clean("Saved"));
});

test("refresh can arrive before acknowledgment without losing the submitted draft", () => {
  const draft = { ...clean("Old"), value: " Saved " };
  const refreshed = receiveNoteDraft(draft, "Saved");
  assert.equal(refreshed.value, " Saved ");
  assert.deepEqual(acknowledgeNoteDraft(refreshed, draft.value), clean("Saved"));
});

test("save acknowledgment keeps edits made after submission with the new saved baseline", () => {
  const draft = { ...clean("Old"), value: "Next edit" };
  const saved = acknowledgeNoteDraft(draft, " Submitted ");
  assert.equal(saved.value, "Next edit");
  assert.equal(saved.saved, "Submitted");
  const refreshed = receiveNoteDraft(saved, "Submitted");
  assert.equal(refreshed.value, "Next edit");
  assert.equal(refreshed.saved, "Submitted");
});
