"use client";

import type { MemberTag } from "./tags";
import { useState } from "react";
import { MembersList, type Member } from "./members-list";

export function MembersView({
  tags,
  members,
  totalMembers,
}: {
  tags: MemberTag[];
  members: Member[];
  totalMembers: number;
}) {
  const initialShown = members.filter((m) => !m.is_moved_out).length;
  const [membersShow, setMembersShow] = useState(initialShown);

  return (
    <>
      <header className="flex flex-col gap-1">
        <h1 className="text-2xl font-semibold">Members</h1>
        <p className="text-sm text-muted-foreground">
          {membersShow}/{totalMembers} total in your ward.
        </p>
      </header>
      <MembersList
        tags={tags}
        members={members}
        onShownCountChange={setMembersShow}
      />
    </>
  );
}
