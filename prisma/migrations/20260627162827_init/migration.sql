-- CreateTable
CREATE TABLE "ward" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'ward',
    "content_locale" TEXT NOT NULL DEFAULT 'en',
    "time_zone" TEXT NOT NULL DEFAULT 'UTC',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "user" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ward_id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "user_ward_id_fkey" FOREIGN KEY ("ward_id") REFERENCES "ward" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "login" (
    "user_id" TEXT NOT NULL PRIMARY KEY,
    "token_hash" TEXT NOT NULL,
    "code_hash" TEXT NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "redirect_path" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "login_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "member" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ward_id" TEXT NOT NULL,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "gender" TEXT NOT NULL,
    "birth_date" TEXT,
    "email" TEXT,
    "is_baptized" BOOLEAN NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "member_ward_id_fkey" FOREIGN KEY ("ward_id") REFERENCES "ward" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "user_ward_id_idx" ON "user"("ward_id");

-- CreateIndex
CREATE UNIQUE INDEX "user_email_key" ON "user"("email");

-- CreateIndex
CREATE INDEX "login_created_at_idx" ON "login"("created_at");

-- CreateIndex
CREATE UNIQUE INDEX "login_token_hash_key" ON "login"("token_hash");

-- CreateIndex
CREATE INDEX "member_ward_id_idx" ON "member"("ward_id");

-- CreateIndex
CREATE INDEX "member_ward_id_status_idx" ON "member"("ward_id", "status");

-- CreateTable
CREATE TABLE "task" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ward_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "state" TEXT NOT NULL DEFAULT 'todo',
    "title" TEXT,
    "description" TEXT,
    "assigned_user_id" TEXT,
    "member_id" TEXT,
    "due_date" TEXT,
    "priority" TEXT NOT NULL DEFAULT 'normal',
    "duration_minutes" INTEGER,
    "completed_at" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "task_ward_id_fkey" FOREIGN KEY ("ward_id") REFERENCES "ward" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "task_assigned_user_id_fkey" FOREIGN KEY ("assigned_user_id") REFERENCES "user" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "task_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "member" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "task_type" (
    "ward_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "name_short" TEXT NOT NULL DEFAULT 'T',
    "color" TEXT NOT NULL DEFAULT '#71717a',
    "configuration" TEXT NOT NULL DEFAULT '{}',
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY ("ward_id", "type"),
    CONSTRAINT "task_type_ward_id_fkey" FOREIGN KEY ("ward_id") REFERENCES "ward" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "task_type_state" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ward_id" TEXT NOT NULL,
    "task_type" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#3b82f6',
    "order_index" INTEGER NOT NULL DEFAULT 0,
    "state_group" TEXT NOT NULL DEFAULT 'active',
    "sunday_meeting_item_type" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "task_type_state_ward_id_fkey" FOREIGN KEY ("ward_id") REFERENCES "ward" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "task_type_state_assignment" (
    "ward_id" TEXT NOT NULL,
    "task_type" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "assign_to_user_id" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    PRIMARY KEY ("ward_id", "task_type", "state"),
    CONSTRAINT "task_type_state_assignment_ward_id_fkey" FOREIGN KEY ("ward_id") REFERENCES "ward" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "task_type_state_assignment_assign_to_user_id_fkey" FOREIGN KEY ("assign_to_user_id") REFERENCES "user" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "task_ward_id_idx" ON "task"("ward_id");

-- CreateIndex
CREATE INDEX "task_ward_id_type_state_idx" ON "task"("ward_id", "type", "state");

-- CreateIndex
CREATE INDEX "task_assigned_user_id_idx" ON "task"("assigned_user_id");

-- CreateIndex
CREATE INDEX "task_member_id_idx" ON "task"("member_id");

-- CreateIndex
CREATE INDEX "task_due_date_idx" ON "task"("due_date");

-- CreateIndex
CREATE INDEX "task_completed_at_idx" ON "task"("completed_at");

-- CreateIndex
CREATE INDEX "task_ward_id_completed_at_idx" ON "task"("ward_id", "completed_at");

-- CreateIndex
CREATE INDEX "task_type_state_task_type_idx" ON "task_type_state"("task_type");

-- CreateIndex
CREATE INDEX "task_type_state_ward_id_idx" ON "task_type_state"("ward_id");

-- CreateIndex
CREATE UNIQUE INDEX "task_type_state_ward_id_task_type_state_key" ON "task_type_state"("ward_id", "task_type", "state");

-- CreateIndex
CREATE INDEX "task_type_state_assignment_assign_to_user_id_idx" ON "task_type_state_assignment"("assign_to_user_id");

-- CreateTable
CREATE TABLE "sunday_meeting" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ward_id" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "information" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "sunday_meeting_ward_id_fkey" FOREIGN KEY ("ward_id") REFERENCES "ward" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "sunday_meeting_item" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sunday_meeting_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "section" TEXT NOT NULL,
    "standard_slot" TEXT,
    "order_index" INTEGER NOT NULL,
    "content" TEXT,
    "hymn_number" INTEGER,
    "task_id" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "sunday_meeting_item_sunday_meeting_id_fkey" FOREIGN KEY ("sunday_meeting_id") REFERENCES "sunday_meeting" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "sunday_meeting_item_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "task" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "sunday_meeting_item_hymn_number_check" CHECK ("hymn_number" IS NULL OR "hymn_number" > 0)
);

-- CreateTable
CREATE TABLE "sunday_meeting_person_assignment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sunday_meeting_id" TEXT NOT NULL,
    "sunday_meeting_item_id" TEXT,
    "role" TEXT NOT NULL,
    "member_id" TEXT,
    "free_text_name" TEXT,
    "order_index" INTEGER NOT NULL DEFAULT 0,
    "visitor_role" TEXT,
    "visitor_role_custom" TEXT,
    "is_presiding_override" BOOLEAN NOT NULL DEFAULT false,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "sunday_meeting_person_assignment_sunday_meeting_id_fkey" FOREIGN KEY ("sunday_meeting_id") REFERENCES "sunday_meeting" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "sunday_meeting_person_assignment_sunday_meeting_item_id_fkey" FOREIGN KEY ("sunday_meeting_item_id") REFERENCES "sunday_meeting_item" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "sunday_meeting_person_assignment_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "member" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "sunday_meeting_person_assignment_person_xor_check" CHECK (
      ("member_id" IS NOT NULL AND "free_text_name" IS NULL)
      OR
      ("member_id" IS NULL AND COALESCE(length(trim("free_text_name")), 0) > 0)
    ),
    CONSTRAINT "sunday_meeting_person_assignment_presiding_check" CHECK ("is_presiding_override" IN (0, 1))
);

-- CreateIndex
CREATE UNIQUE INDEX "sunday_meeting_ward_id_date_key" ON "sunday_meeting"("ward_id", "date");

-- CreateIndex
CREATE INDEX "sunday_meeting_ward_id_type_date_idx" ON "sunday_meeting"("ward_id", "type", "date");

-- CreateIndex
CREATE UNIQUE INDEX "sunday_meeting_item_sunday_meeting_id_order_index_key" ON "sunday_meeting_item"("sunday_meeting_id", "order_index");

-- CreateIndex
CREATE UNIQUE INDEX "sunday_meeting_item_sunday_meeting_id_standard_slot_key" ON "sunday_meeting_item"("sunday_meeting_id", "standard_slot");

-- CreateIndex
CREATE INDEX "sunday_meeting_item_task_id_idx" ON "sunday_meeting_item"("task_id");

-- CreateIndex
CREATE UNIQUE INDEX "idx_sunday_meeting_assignment_meeting_role_order_unique"
ON "sunday_meeting_person_assignment"("sunday_meeting_id", "role", "order_index")
WHERE "sunday_meeting_item_id" IS NULL;

-- CreateIndex
CREATE UNIQUE INDEX "idx_sunday_meeting_assignment_item_role_order_unique"
ON "sunday_meeting_person_assignment"("sunday_meeting_item_id", "role", "order_index")
WHERE "sunday_meeting_item_id" IS NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "idx_sunday_meeting_assignment_one_leader"
ON "sunday_meeting_person_assignment"("sunday_meeting_id")
WHERE "role" = 'leader' AND "sunday_meeting_item_id" IS NULL;

-- CreateIndex
CREATE UNIQUE INDEX "idx_sunday_meeting_assignment_one_presiding_override"
ON "sunday_meeting_person_assignment"("sunday_meeting_id")
WHERE "role" = 'visitor' AND "sunday_meeting_item_id" IS NULL AND "is_presiding_override" = 1;

-- CreateIndex
CREATE INDEX "sunday_meeting_person_assignment_member_id_role_sunday_meeting_id_idx"
ON "sunday_meeting_person_assignment"("member_id", "role", "sunday_meeting_id");
