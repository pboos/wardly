import type { FieldChanges } from "./sync-model";

export function FieldChangeList({ changes }: { changes: FieldChanges }) {
  const entries = Object.entries(changes);
  if (entries.length === 0) {
    return <p className="text-sm text-muted-foreground">No field changes.</p>;
  }
  return (
    <div className="flex flex-col gap-0.5 pl-4">
      {entries.map(([field, change]) => (
        <div key={field} className="text-xs break-words text-muted-foreground">
          <span className="font-mono">{field}</span>:{" "}
          <span>{String(change.from) || "∅"}</span>
          {" → "}
          <span>{String(change.to) || "∅"}</span>
        </div>
      ))}
    </div>
  );
}
