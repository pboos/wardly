ALTER TABLE "meeting_agenda_template" ADD COLUMN "default_assigned_user_id" TEXT REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "meeting_agenda_item" ADD COLUMN "assigned_user_id" TEXT REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "meeting_agenda_item" ADD COLUMN "assignment_overridden" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "meeting_agenda_template" ADD COLUMN "instructions" TEXT NOT NULL DEFAULT '';
ALTER TABLE "meeting_agenda_item" ADD COLUMN "instructions" TEXT NOT NULL DEFAULT '';
CREATE TABLE "meeting_suggestion_receipt" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "meeting_id" TEXT NOT NULL REFERENCES "leadership_meeting"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "fingerprint" TEXT NOT NULL,
  "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

PRAGMA foreign_keys=OFF;
CREATE TABLE "meeting_agenda_topic" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "series_id" TEXT NOT NULL REFERENCES "leadership_meeting_series"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "notes" TEXT NOT NULL DEFAULT '',
  "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "meeting_agenda_topic_series_id_idx" ON "meeting_agenda_topic"("series_id");

CREATE TEMP TABLE "agenda_topic_roots" AS
WITH RECURSIVE
edges(a, b) AS (
  SELECT DISTINCT first.template_id, second.template_id
  FROM meeting_agenda_item_occurrence first_link
  JOIN meeting_agenda_occurrence first ON first.id = first_link.occurrence_id
  JOIN meeting_agenda_template first_template ON first_template.id = first.template_id
  JOIN meeting_agenda_item_occurrence second_link ON second_link.item_id = first_link.item_id
  JOIN meeting_agenda_occurrence second ON second.id = second_link.occurrence_id
  JOIN meeting_agenda_template second_template ON second_template.id = second.template_id
  WHERE first_template.series_id = second_template.series_id
),
reachable(template_id, root) AS (
  SELECT id, id FROM meeting_agenda_template
  UNION
  SELECT edges.b, reachable.root FROM reachable JOIN edges ON edges.a = reachable.template_id
)
SELECT template_id, MIN(root) AS topic_id FROM reachable GROUP BY template_id;

INSERT INTO "meeting_agenda_topic" (id, series_id, created_at, updated_at)
SELECT roots.topic_id, template.series_id, MIN(template.created_at), MAX(template.updated_at)
FROM agenda_topic_roots roots JOIN meeting_agenda_template template ON template.id = roots.template_id
GROUP BY roots.topic_id, template.series_id;

CREATE TABLE "new_meeting_agenda_template" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "series_id" TEXT NOT NULL REFERENCES "leadership_meeting_series"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "topic_id" TEXT NOT NULL REFERENCES "meeting_agenda_topic"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "title" TEXT NOT NULL,
  "instructions" TEXT NOT NULL DEFAULT '',
  "duration_minutes" INTEGER NOT NULL,
  "recurrence" TEXT NOT NULL,
  "anchor_date" TEXT NOT NULL,
  "after_date" TEXT,
  "after_meeting_date" TEXT,
  "suggestion_key" TEXT,
  "default_assigned_user_id" TEXT REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  "archived" BOOLEAN NOT NULL DEFAULT false,
  "position" INTEGER NOT NULL DEFAULT 0,
  "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_meeting_agenda_template"
(id, series_id, topic_id, title, instructions, duration_minutes, recurrence, anchor_date,
 after_date, after_meeting_date, suggestion_key, default_assigned_user_id, archived, position, created_at, updated_at)
SELECT template.id, template.series_id, roots.topic_id, template.title, template.instructions,
 template.duration_minutes, template.recurrence, template.anchor_date, template.after_date,
 template.after_meeting_date, template.suggestion_key, template.default_assigned_user_id,
 template.archived, template.position, template.created_at, template.updated_at
FROM "meeting_agenda_template" template JOIN agenda_topic_roots roots ON roots.template_id = template.id;
DROP TABLE "meeting_agenda_template";
ALTER TABLE "new_meeting_agenda_template" RENAME TO "meeting_agenda_template";
CREATE INDEX "meeting_agenda_template_series_id_archived_idx" ON "meeting_agenda_template"("series_id", "archived");
CREATE INDEX "meeting_agenda_template_topic_id_idx" ON "meeting_agenda_template"("topic_id");
DROP TABLE "agenda_topic_roots";
PRAGMA foreign_key_check;
PRAGMA foreign_keys=ON;
