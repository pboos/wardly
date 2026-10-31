ALTER TABLE "task" ADD COLUMN "owner_user_id" TEXT REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "task_owner_user_id_idx" ON "task"("owner_user_id");

UPDATE "task" SET "owner_user_id" = "assigned_user_id";
