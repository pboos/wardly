export type DigestTask = {
  type: string;
  state: string;
  title: string | null;
  description: string | null;
  member: { first_name: string; last_name: string } | null;
  due_date: string | null;
  priority: string;
};

export type TaskDigest = {
  to: string;
  name: string;
  wardName: string;
  sundayDate: string;
  meetingTime: string;
  timeZone: string;
  tasksUrl: string;
  tasks: DigestTask[];
};

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (char) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[char]!,
  );
}

export function renderTaskDigest(digest: TaskDigest) {
  const rows = digest.tasks.map((task) =>
    [
      `${task.type}: ${[task.title, task.member && `${task.member.first_name} ${task.member.last_name}`].filter(Boolean).join(" — ") || task.type}`,
      `Status: ${task.state} · Priority: ${task.priority}${task.due_date ? ` · Due: ${task.due_date}` : ""}`,
      task.description,
    ]
      .filter(Boolean)
      .join("\n"),
  );
  const intro = `${digest.wardName} — Sunday ${digest.sundayDate}. Sacrament meeting starts at ${digest.meetingTime} (${digest.timeZone}).`;
  return {
    subject: `Your Sunday tasks — ${digest.wardName} — ${digest.sundayDate}`,
    text: [
      `Hi ${digest.name},`,
      intro,
      `Your ${rows.length} unfinished assigned task(s):`,
      ...rows,
      `View my tasks: ${digest.tasksUrl}`,
    ].join("\n\n"),
    html: `<!doctype html><html><body style="font-family:sans-serif;line-height:1.5;max-width:640px;margin:auto;padding:16px;overflow-wrap:anywhere">
      <p>Hi ${escapeHtml(digest.name)},</p><p>${escapeHtml(intro)}</p>
      <p>Your ${rows.length} unfinished assigned task(s):</p>
      <ul>${rows.map((row) => `<li style="margin-bottom:16px;white-space:pre-wrap">${escapeHtml(row)}</li>`).join("")}</ul>
      <p><a href="${escapeHtml(digest.tasksUrl)}">View my tasks</a></p>
      </body></html>`,
  };
}
