-- CreateTable
CREATE TABLE "ward" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'ward',
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
    "deadline" TEXT,
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
    "assign_to_user_id" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "task_type_state_ward_id_fkey" FOREIGN KEY ("ward_id") REFERENCES "ward" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "task_type_state_assign_to_user_id_fkey" FOREIGN KEY ("assign_to_user_id") REFERENCES "user" ("id") ON DELETE SET NULL ON UPDATE CASCADE
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
CREATE INDEX "task_deadline_idx" ON "task"("deadline");

-- CreateIndex
CREATE INDEX "task_completed_at_idx" ON "task"("completed_at");

-- CreateIndex
CREATE INDEX "task_ward_id_completed_at_idx" ON "task"("ward_id", "completed_at");

-- CreateIndex
CREATE INDEX "task_type_state_task_type_idx" ON "task_type_state"("task_type");

-- CreateIndex
CREATE INDEX "task_type_state_ward_id_idx" ON "task_type_state"("ward_id");

-- CreateIndex
CREATE UNIQUE INDEX "task_type_state_task_type_state_key" ON "task_type_state"("task_type", "state");
