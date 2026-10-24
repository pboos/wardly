import type { Db } from "./store";
import type { SharedNotesEdit } from "./types";

type TopicLinks = {
  occurrences: { occurrence: { template: { topic_id: string } } }[];
};

export function topicId(item: TopicLinks): string {
  const ids = new Set(item.occurrences.map((link) => link.occurrence.template.topic_id));
  const id = ids.values().next().value;
  if (ids.size !== 1 || !id)
    throw new Error("This discussion has inconsistent topic links. Refresh the agenda.");
  return id;
}

export async function saveSharedNotes(
  db: Db,
  item: TopicLinks & { meeting: { series_id: string } },
  edit: SharedNotesEdit | undefined,
) {
  if (edit === undefined) return;
  if (!edit || typeof edit.value !== "string" || typeof edit.expected !== "string" ||
      edit.value.length > 4000 || edit.expected.length > 4000)
    throw new Error("Shared notes must be at most 4000 characters.");
  const topic = await db.meeting_agenda_topic.findFirst({
    where: { id: topicId(item), series_id: item.meeting.series_id },
  });
  if (!topic) throw new Error("Discussion topic not found.");
  const value = edit.value.trim();
  if (topic.notes === value) return;
  if (topic.notes !== edit.expected)
    throw new Error("Shared notes changed in another window. Copy your draft, discard changes and reopen this item to review the latest notes.");
  await db.meeting_agenda_topic.update({
    where: { id: topic.id },
    data: { notes: value, updated_at: new Date() },
  });
}
