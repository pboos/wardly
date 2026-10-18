import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import Database from "better-sqlite3";

const migrations = new URL("../../prisma/migrations/", import.meta.url);
test("topic backfill follows transitive appearance links and preserves the existing graph", () => {
  const db = new Database(":memory:");
  try {
    for (const name of readdirSync(migrations).filter((name) => /^\d/.test(name) && name < "20261017120000").sort())
      db.exec(readFileSync(new URL(`${name}/migration.sql`, migrations), "utf8"));
    db.exec(`
      INSERT INTO ward (id, name) VALUES ('ward', 'Ward');
      INSERT INTO leadership_meeting_series (id, ward_id, kind, schedule, time_zone) VALUES ('series', 'ward', 'bishopric', '{}', 'UTC');
      INSERT INTO leadership_meeting (id, series_id, date, scheduled_date, start_time) VALUES ('meeting', 'series', '2026-01-01', '2026-01-01', '09:00');
    `);
    for (const [index, id] of ['a', 'b', 'c', 'prayer-one', 'prayer-two'].entries()) {
      db.prepare(`INSERT INTO meeting_agenda_template (id, series_id, title, duration_minutes, recurrence, anchor_date, after_date, after_meeting_date, suggestion_key, archived, position, created_at, updated_at)
        VALUES (?, 'series', 'Prayer', 7, '{}', '2026-01-01', '2026-01-02', '2026-01-03', 'prayer', ?, ?, '2025-01-01', '2025-01-02')`).run(id, index % 2, index + 4);
      db.prepare(`INSERT INTO meeting_agenda_occurrence (id, template_id, occurrence_key, due_date) VALUES (?, ?, 'key', '2026-01-01')`).run(`occ-${id}`, id);
    }
    for (const id of ['first', 'second'])
      db.prepare(`INSERT INTO meeting_agenda_item (id, meeting_id, title, duration_minutes, position, decision) VALUES (?, 'meeting', 'History', 9, 0, 'Keep notes')`).run(id);
    for (const [index, [item, occurrence]] of [['first', 'a'], ['first', 'b'], ['second', 'b'], ['second', 'c']].entries())
      db.prepare(`INSERT INTO meeting_agenda_item_occurrence (id, item_id, occurrence_id) VALUES (?, ?, ?)`).run(`link-${index}`, item, `occ-${occurrence}`);
    const before = db.prepare('SELECT * FROM meeting_agenda_template ORDER BY id').all();
    db.exec(readFileSync(new URL('20261017120000_agenda_assignees/migration.sql', migrations), 'utf8'));
    const after = db.prepare('SELECT * FROM meeting_agenda_template ORDER BY id').all();
    assert.deepEqual(after.map(({ topic_id, instructions, default_assigned_user_id, ...original }) => original), before);
    assert.deepEqual(after.slice(0, 3).map((row) => row.topic_id), ['a', 'a', 'a']);
    assert.notEqual(after[3].topic_id, after[4].topic_id);
    assert.equal(db.prepare('SELECT COUNT(*) AS count FROM meeting_agenda_topic').get().count, 3);
    assert.equal(db.prepare('SELECT COUNT(*) AS count FROM meeting_agenda_occurrence').get().count, 5);
    assert.equal(db.prepare('SELECT COUNT(*) AS count FROM meeting_agenda_item_occurrence').get().count, 4);
    assert.ok(db.prepare('SELECT decision FROM meeting_agenda_item').all().every((row) => row.decision === 'Keep notes'));
    assert.deepEqual(db.pragma('foreign_key_check'), []);
    assert.throws(() => db.prepare('UPDATE meeting_agenda_template SET topic_id = NULL WHERE id = ?').run('a'), /NOT NULL/);
    assert.throws(() => db.prepare('UPDATE meeting_agenda_template SET topic_id = ? WHERE id = ?').run('missing', 'a'), /FOREIGN KEY/);
    assert.ok(db.pragma('index_list(meeting_agenda_template)').some((index) => index.name === 'meeting_agenda_template_topic_id_idx'));
    assert.ok(db.pragma('index_list(meeting_agenda_template)').some((index) => index.name === 'meeting_agenda_template_series_id_archived_idx'));
  } finally {
    db.close();
  }
});
