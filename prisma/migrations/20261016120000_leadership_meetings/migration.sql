-- CreateTable
CREATE TABLE "leadership_meeting_series" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ward_id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "schedule" TEXT NOT NULL,
    "start_time" TEXT NOT NULL DEFAULT '09:00',
    "time_zone" TEXT NOT NULL,
    "target_minutes" INTEGER NOT NULL DEFAULT 60,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "leadership_meeting_series_ward_id_fkey" FOREIGN KEY ("ward_id") REFERENCES "ward" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "leadership_meeting" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "series_id" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "scheduled_date" TEXT NOT NULL,
    "start_time" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'planned',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "leadership_meeting_series_id_fkey" FOREIGN KEY ("series_id") REFERENCES "leadership_meeting_series" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "meeting_agenda_template" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "series_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "duration_minutes" INTEGER NOT NULL,
    "recurrence" TEXT NOT NULL,
    "anchor_date" TEXT NOT NULL,
    "after_date" TEXT,
    "after_meeting_date" TEXT,
    "suggestion_key" TEXT,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "meeting_agenda_template_series_id_fkey" FOREIGN KEY ("series_id") REFERENCES "leadership_meeting_series" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "meeting_agenda_occurrence" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "template_id" TEXT NOT NULL,
    "occurrence_key" TEXT NOT NULL,
    "due_date" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "meeting_agenda_occurrence_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "meeting_agenda_template" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "meeting_agenda_item" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "meeting_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "duration_minutes" INTEGER NOT NULL,
    "position" INTEGER NOT NULL,
    "outcome" TEXT NOT NULL DEFAULT 'pending',
    "decision" TEXT NOT NULL DEFAULT '',
    "predecessor_id" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "meeting_agenda_item_meeting_id_fkey" FOREIGN KEY ("meeting_id") REFERENCES "leadership_meeting" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "meeting_agenda_item_predecessor_id_fkey" FOREIGN KEY ("predecessor_id") REFERENCES "meeting_agenda_item" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "meeting_agenda_item_occurrence" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "item_id" TEXT NOT NULL,
    "occurrence_id" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "meeting_agenda_item_occurrence_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "meeting_agenda_item" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "meeting_agenda_item_occurrence_occurrence_id_fkey" FOREIGN KEY ("occurrence_id") REFERENCES "meeting_agenda_occurrence" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "meeting_agenda_item_task" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "item_id" TEXT NOT NULL,
    "task_id" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "meeting_agenda_item_task_item_id_fkey" FOREIGN KEY ("item_id") REFERENCES "meeting_agenda_item" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "meeting_agenda_item_task_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "task" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "leadership_meeting_series_ward_id_kind_key" ON "leadership_meeting_series"("ward_id", "kind");

-- CreateIndex
CREATE INDEX "leadership_meeting_series_id_date_idx" ON "leadership_meeting"("series_id", "date");

-- CreateIndex
CREATE UNIQUE INDEX "leadership_meeting_series_id_scheduled_date_key" ON "leadership_meeting"("series_id", "scheduled_date");

-- CreateIndex
CREATE INDEX "meeting_agenda_template_series_id_archived_idx" ON "meeting_agenda_template"("series_id", "archived");

-- CreateIndex
CREATE UNIQUE INDEX "meeting_agenda_occurrence_template_id_occurrence_key_key" ON "meeting_agenda_occurrence"("template_id", "occurrence_key");

-- CreateIndex
CREATE UNIQUE INDEX "meeting_agenda_item_predecessor_id_key" ON "meeting_agenda_item"("predecessor_id");

-- CreateIndex
CREATE INDEX "meeting_agenda_item_meeting_id_position_idx" ON "meeting_agenda_item"("meeting_id", "position");

-- CreateIndex
CREATE INDEX "meeting_agenda_item_occurrence_occurrence_id_idx" ON "meeting_agenda_item_occurrence"("occurrence_id");

-- CreateIndex
CREATE UNIQUE INDEX "meeting_agenda_item_occurrence_item_id_occurrence_id_key" ON "meeting_agenda_item_occurrence"("item_id", "occurrence_id");

-- CreateIndex
CREATE INDEX "meeting_agenda_item_task_task_id_idx" ON "meeting_agenda_item_task"("task_id");

-- CreateIndex
CREATE UNIQUE INDEX "meeting_agenda_item_task_item_id_task_id_key" ON "meeting_agenda_item_task"("item_id", "task_id");
