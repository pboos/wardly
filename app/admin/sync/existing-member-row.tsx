import type { ExistingMember } from "./sync-model";

export function ExistingMemberRow({ member }: { member: ExistingMember }) {
  return (
    <div className="text-sm">
      {member.first_name} {member.last_name}
      {member.birth_date && (
        <span className="text-muted-foreground">
          {" "}
          — born {member.birth_date}
        </span>
      )}
      {member.gender && (
        <span className="text-muted-foreground"> ({member.gender})</span>
      )}
    </div>
  );
}
