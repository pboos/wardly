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
