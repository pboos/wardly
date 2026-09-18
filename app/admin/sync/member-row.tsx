import type { IncomingMember } from "./sync-model";

export function MemberRow({ member }: { member: IncomingMember }) {
  return (
    <div className="text-sm">
      {member.firstName} {member.lastName}
      {member.birthDate && (
        <span className="text-muted-foreground">
          {" "}
          — born {member.birthDate}
        </span>
      )}
      {member.gender && (
        <span className="text-muted-foreground"> ({member.gender})</span>
      )}
    </div>
  );
}
