ALTER TABLE "meeting_agenda_template" ADD COLUMN "position" INTEGER NOT NULL DEFAULT 0;
UPDATE "meeting_agenda_template" AS target SET "position" = (
  SELECT COUNT(*) FROM "meeting_agenda_template" AS prior
  WHERE prior."series_id" = target."series_id"
    AND (prior."created_at" < target."created_at"
      OR (prior."created_at" = target."created_at" AND prior."id" < target."id"))
);
