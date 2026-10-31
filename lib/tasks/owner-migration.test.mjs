import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import Database from "better-sqlite3";

const migrations = new URL("../../prisma/migrations/", import.meta.url);
const ownerMigration = "20261031120000_task_owner";

test("owner migration preserves existing tasks and links, backfills assignees, and enforces independent user references", () => {
  const db = new Database(":memory:");
  try {
    for (const name of readdirSync(migrations).filter((name) => /^\d/.test(name) && name < ownerMigration).sort()) {
      db.exec(readFileSync(new URL(`${name}/migration.sql`, migrations), "utf8"));
    }
    db.exec(`
      INSERT INTO ward (id, name) VALUES ('ward', 'Ward');
      INSERT INTO user (id, ward_id, email, name) VALUES ('alice', 'ward', 'alice@example.test', 'Alice'), ('bob', 'ward', 'bob@example.test', 'Bob');
      INSERT INTO task (id, ward_id, type, assigned_user_id, title, state, completed_at) VALUES
        ('assigned', 'ward', 'todo', 'alice', 'Active task', 'todo', NULL),
        ('unassigned', 'ward', 'todo', NULL, 'Unassigned task', 'todo', NULL),
        ('closed', 'ward', 'todo', 'bob', 'Finished task', 'done', '2026-10-30');
      INSERT INTO sunday_meeting (id, ward_id, date, type) VALUES ('meeting', 'ward', '2026-11-01', 'sacrament');
      INSERT INTO sunday_meeting_item (id, sunday_meeting_id, type, section, order_index, task_id) VALUES ('link', 'meeting', 'calling_sustain', 'business', 0, 'assigned');
    `);
    const before = db.prepare("SELECT * FROM task ORDER BY id").all();
    const links = db.prepare("SELECT * FROM sunday_meeting_item").all();
    db.exec(readFileSync(new URL(`${ownerMigration}/migration.sql`, migrations), "utf8"));
    const after = db.prepare("SELECT * FROM task ORDER BY id").all();
    assert.deepEqual(after.map((task) => {
      const original = { ...task };
      delete original.owner_user_id;
      return original;
    }), before);
    assert.ok(after.every((task) => task.owner_user_id === task.assigned_user_id));
    assert.deepEqual(db.prepare("SELECT * FROM sunday_meeting_item").all(), links);
    assert.ok(db.pragma("index_list(task)").some(({ name }) => name === "task_owner_user_id_idx"));
    assert.throws(() => db.prepare("UPDATE task SET owner_user_id = 'missing' WHERE id = 'assigned'").run(), /FOREIGN KEY/);
    db.exec("UPDATE task SET assigned_user_id = 'bob' WHERE id = 'assigned'; DELETE FROM user WHERE id = 'alice';");
    assert.deepEqual(db.prepare("SELECT owner_user_id, assigned_user_id FROM task WHERE id = 'assigned'").get(), {
      owner_user_id: null,
      assigned_user_id: "bob",
    });
    db.exec("UPDATE task SET owner_user_id = 'bob' WHERE id = 'unassigned'; DELETE FROM user WHERE id = 'bob';");
    assert.ok(db.prepare("SELECT * FROM task").all().every((task) => task.owner_user_id === null && task.assigned_user_id === null));
    assert.equal(db.prepare("SELECT COUNT(*) AS count FROM task").get().count, 3);
    assert.deepEqual(db.pragma("foreign_key_check"), []);
  } finally {
    db.close();
  }
});
