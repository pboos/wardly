ALTER TABLE "meeting_agenda_template" ADD COLUMN "default_assigned_user_id" TEXT REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "meeting_agenda_item" ADD COLUMN "assigned_user_id" TEXT REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "meeting_agenda_item" ADD COLUMN "assignment_overridden" BOOLEAN NOT NULL DEFAULT false;
