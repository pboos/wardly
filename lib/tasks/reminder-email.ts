import { digestProgress, groupDigestTasks } from "./reminder-groups";

export type DigestTask = {
  type: string;
  typeKey?: string;
  typeColor?: string;
  stateColor?: string;
  progress?: number;
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

// Email clients need literal sRGB colors and inline styles rather than app CSS.
const palette = {
  background: "#f5f4f5",
  card: "#ffffff",
  foreground: "#252126",
  muted: "#726b75",
  border: "#e8e5e9",
  secondary: "#f4f4f5",
  primary: "#17658b",
};

function safeColor(value: string | undefined): string {
  return value && /^#[0-9a-f]{6}$/i.test(value) ? value : "#71717a";
}

function taskHeading(task: DigestTask): string {
  return (
    [
      task.member && `${task.member.first_name} ${task.member.last_name}`,
      task.title,
    ]
      .filter(Boolean)
      .join(" — ") || task.type
  );
}

function taskDetails(task: DigestTask): string {
  return task.due_date ? `Due: ${task.due_date}` : "";
}

function renderTask(task: DigestTask, index: number): string {
  const percent = Math.round(digestProgress(task) * 100);
  const stateColor = safeColor(task.stateColor);
  const typeColor = safeColor(task.typeColor);
  const badgeStyle = `display:inline-block;padding:1px 8px;border-radius:5px;background:${palette.secondary};color:${palette.foreground};font-size:12px;line-height:1.7;vertical-align:top;margin:2px 4px 2px 0`;
  return `<tr><td style="padding:12px 16px;${index ? `border-top:1px solid ${palette.border};` : ""}">
    <p style="margin:0 0 4px;font-size:15px;font-weight:600;color:${palette.foreground}">${escapeHtml(taskHeading(task))}</p>
    <p style="margin:0;font-size:12px;line-height:1.7">
      <span style="${badgeStyle}"><span style="color:${typeColor}">●</span> ${escapeHtml(task.type)}</span>
      <span style="${badgeStyle}"><span style="color:${stateColor}">${percent === 100 ? "✓" : percent === 0 ? "◌" : "●"}</span> ${escapeHtml(task.state)} <span style="color:${palette.muted}">· ${percent}%</span></span>
    </p>
    ${task.description ? `<p style="margin:6px 0 0;font-size:13px;color:${palette.muted};white-space:pre-wrap">${escapeHtml(task.description)}</p>` : ""}
    ${task.due_date ? `<p style="margin:6px 0 0;font-size:12px;color:${palette.muted}">${escapeHtml(taskDetails(task))}</p>` : ""}
  </td></tr>`;
}

export function renderTaskDigest(digest: TaskDigest) {
  const groups = groupDigestTasks(digest.tasks);
  const count = digest.tasks.length;
  const intro = `${digest.wardName} — Sunday ${digest.sundayDate}. Sacrament meeting starts at ${digest.meetingTime} (${digest.timeZone}).`;
  const summary = `${count} unfinished assigned ${count === 1 ? "task" : "tasks"}`;
  const cards = groups
    .map(
      (
        group,
      ) => `<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom:20px;background:${palette.card};border:1px solid ${palette.border};border-radius:8px;table-layout:fixed">
    <tr><td style="padding:14px 20px;border-bottom:1px solid ${palette.border};background:${palette.secondary};border-radius:8px 8px 0 0">
      <h2 style="margin:0;font-size:16px;font-weight:600;color:${palette.foreground}">${escapeHtml(group.name)} <span style="font-size:13px;font-weight:400;color:${palette.muted}">(${group.tasks.length})</span></h2>
    </td></tr>${group.tasks.map(renderTask).join("")}</table>`,
    )
    .join("");
  return {
    subject: `Your Sunday tasks — ${digest.wardName} — ${digest.sundayDate}`,
    text: [
      `Hi ${digest.name},`,
      intro,
      `Your ${summary}.`,
      ...groups.map((group) =>
        [
          `${group.name} (${group.tasks.length})`,
          ...group.tasks.map((task) =>
            [
              taskHeading(task),
              `Type: ${task.type}`,
              `Status: ${task.state} (${Math.round(digestProgress(task) * 100)}%)`,
              taskDetails(task),
              task.description,
            ]
              .filter(Boolean)
              .join("\n"),
          ),
        ].join("\n\n"),
      ),
      `View my tasks: ${digest.tasksUrl}`,
    ].join("\n\n"),
    html: `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
    <body style="margin:0;padding:0;background:${palette.background};font-family:Arial,Helvetica,sans-serif;line-height:1.5;color:${palette.foreground};overflow-wrap:anywhere;word-break:break-word">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0"><tr><td style="padding:24px 12px">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" align="center" style="max-width:640px;table-layout:fixed"><tr><td>
          <p style="margin:0 0 6px;font-size:12px;font-weight:600;letter-spacing:1px;color:${palette.primary}">WARDLY · ${escapeHtml(digest.wardName)}</p>
          <h1 style="margin:0 0 8px;font-size:28px;line-height:1.2">Your Sunday tasks</h1>
          <p style="margin:0 0 18px;font-size:13px;color:${palette.muted}">Sunday ${escapeHtml(digest.sundayDate)} · ${escapeHtml(digest.meetingTime)} (${escapeHtml(digest.timeZone)})</p>
          <p style="margin:0 0 4px">Hi ${escapeHtml(digest.name)},</p>
          <p style="margin:0 0 18px;font-size:14px;color:${palette.muted}">You have ${summary}. Sacrament meeting starts at ${escapeHtml(digest.meetingTime)}.</p>
          <p style="margin:0 0 24px"><a href="${escapeHtml(digest.tasksUrl)}" style="display:inline-block;background:${palette.primary};color:#ffffff;padding:10px 18px;border-radius:6px;font-size:14px;font-weight:600;text-decoration:none">View my tasks</a></p>
          ${cards}
          <p style="margin:0;font-size:12px;color:${palette.muted}">Tasks are grouped by topic, with the most progress first in each group.</p>
        </td></tr></table>
      </td></tr></table>
    </body></html>`,
  };
}
