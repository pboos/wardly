import test from "node:test";
import assert from "node:assert/strict";
import { digestProgress, groupDigestTasks } from "./reminder-groups.ts";
import { renderTaskDigest } from "./reminder-email.ts";

const task = (typeKey, type, progress, title) => ({
  typeKey,
  type,
  progress,
  title,
  state: "Awaiting next step",
  typeColor: "#6366f1",
  stateColor: "#a855f7",
  description: null,
  member: null,
  due_date: null,
  priority: "normal",
});
const digest = (tasks) => ({
  to: "preview@example.com",
  name: "Alex",
  wardName: "Preview Ward",
  sundayDate: "2026-10-04",
  meetingTime: "09:00",
  timeZone: "UTC",
  tasksUrl: "https://example.com/tasks?filter=mine",
  tasks,
});

test("all built-in task families group by stable key, independent of ward labels", () => {
  const keys = [
    [
      "temple_recommend",
      "temple_recommend_limited",
      "temple_endowment_living",
      "temple_sealing_living",
    ],
    ["priesthood_aaronic", "priesthood_melchizedek"],
    ["calling", "calling_release"],
    [
      "youth_interview",
      "check_in",
      "patriarchal_blessing_recommend",
      "missionary_recommendation",
    ],
    ["child_baptism", "child_naming_blessing"],
    ["todo", "custom_type", "unknown_type"],
  ];
  const tasks = keys
    .flat()
    .reverse()
    .map((key) => task(key, "Ward-specific name", 0, key));
  const groups = groupDigestTasks(tasks);
  assert.deepEqual(
    groups.map((g) => g.name),
    [
      "Temple",
      "Priesthood",
      "Callings",
      "Interviews & recommendations",
      "Children & ordinances",
      "Other tasks",
    ],
  );
  groups.forEach((group, index) =>
    assert.deepEqual(
      group.tasks.map((t) => t.typeKey).sort(),
      [...keys[index]].sort(),
    ),
  );
  assert.equal(groups.flatMap((g) => g.tasks).length, tasks.length);
  assert.deepEqual(groupDigestTasks([]), []);
});

test("sorts 100% to 0% within groups, then type name, preserving equal ties", () => {
  const tasks = [
    task("todo", "Task", 1, "Other group"),
    task("temple_recommend", "Z type", 0, "Zero"),
    task("temple_recommend", "Z type", 0.5, "Newest tie"),
    task("temple_recommend", "Z type", 0.5, "Older tie"),
    task("temple_recommend_limited", "A type", 0.5, "Alphabetical tie"),
    task("temple_recommend", "Z type", 1, "Hundred"),
  ];
  const original = [...tasks];
  const groups = groupDigestTasks(tasks);
  assert.deepEqual(
    groups[0].tasks.map((t) => t.title),
    ["Hundred", "Alphabetical tie", "Newest tie", "Older tie", "Zero"],
  );
  assert.deepEqual(tasks, original);
  const email = renderTaskDigest(digest(tasks));
  for (const output of [email.text, email.html]) {
    assert.ok(output.indexOf("Hundred") < output.indexOf("Zero"));
    assert.ok(output.indexOf("Zero") < output.indexOf("Other group"));
    assert.match(output, /100%/);
    assert.match(output, /50%/);
  }
  assert.doesNotMatch(email.html, /Priesthood/);
});

test("missing metadata falls back safely and unsafe colors cannot inject HTML", () => {
  const invalid = task("custom", "Custom <type>", NaN, "A long title");
  invalid.typeColor = '#ffffff" onmouseover="alert(1)';
  invalid.stateColor = "red;background:url(https://example.com/tracker)";
  const email = renderTaskDigest(digest([invalid]));
  assert.match(email.html, /Other tasks/);
  assert.match(email.html, /Custom &lt;type&gt;/);
  assert.match(email.html, /0%/);
  assert.doesNotMatch(email.html, /onmouseover|tracker|NaN/);
  assert.equal(digestProgress(task("todo", "Task", -1, "Low")), 0);
  assert.equal(digestProgress(task("todo", "Task", 2, "High")), 1);
  assert.equal(digestProgress({ type: "Legacy", state: "todo" }), 0);
});
