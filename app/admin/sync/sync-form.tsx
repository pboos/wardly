"use client";

import { useTransition, useState } from "react";
import { IconCopy, IconCheck } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { LCR_SCRIPT } from "./lcr-script";
import {
  parseSync,
  commitSync,
  type SyncDiff,
  type ResolvedPlan,
  type IncomingMember,
  type ExistingMember,
  type FieldChanges,
} from "./actions";

type Plan =
  | { step: "idle" }
  | { step: "preview"; diff: SyncDiff }
  | { step: "done"; summary: { added: number; moved: number; updated: number } };

export function SyncForm() {
  const [plan, setPlan] = useState<Plan>({ step: "idle" });
  const [rawText, setRawText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [ambiguousResolutions, setAmbiguousResolutions] = useState<
    Record<number, string>
  >({});
  const [nameChangeResolutions, setNameChangeResolutions] = useState<
    Record<number, "merge" | "separate">
  >({});

  const allAmbiguousResolved =
    plan.step === "preview" &&
    (plan.diff.ambiguous.length === 0 ||
      plan.diff.ambiguous.every((_, i) => ambiguousResolutions[i]));

  function handleSync() {
    setError(null);
    startTransition(async () => {
      const result = await parseSync(rawText);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setAmbiguousResolutions({});
      setNameChangeResolutions({});
      setPlan({ step: "preview", diff: result });
    });
  }

  function buildResolvedPlan(): ResolvedPlan {
    if (plan.step !== "preview") return { inserts: [], moves: [], updates: [], merges: [] };
    const diff = plan.diff;

    const consumedNew = new Set<IncomingMember>();
    const consumedMoved = new Set<ExistingMember>();
    const merges: ResolvedPlan["merges"] = [];

    for (let i = 0; i < diff.possibleNameChanges.length; i++) {
      if (nameChangeResolutions[i] === "merge") {
        const pc = diff.possibleNameChanges[i];
        consumedNew.add(pc.incoming);
        consumedMoved.add(pc.movedMember);
        merges.push({
          existingId: pc.movedMember.id,
          firstName: pc.incoming.firstName,
          lastName: pc.incoming.lastName,
          email: pc.incoming.email,
          birthDate: pc.incoming.birthDate,
          isBaptized: pc.incoming.isBaptized,
        });
      }
    }

    const inserts: IncomingMember[] = [];
    for (const inc of diff.new) {
      if (!consumedNew.has(inc)) inserts.push(inc);
    }
    for (let i = 0; i < diff.ambiguous.length; i++) {
      if (ambiguousResolutions[i] === "new") {
        inserts.push(diff.ambiguous[i].incoming);
      }
    }

    const moves: string[] = [];
    for (const m of diff.moved) {
      if (!consumedMoved.has(m)) moves.push(m.id);
    }

    const updates: ResolvedPlan["updates"] = diff.updated.map((u) => ({
      id: u.existing.id,
      email: u.incoming.email,
      birthDate: u.incoming.birthDate,
      isBaptized: u.incoming.isBaptized,
      reactivate: u.reactivate,
    }));

    for (let i = 0; i < diff.ambiguous.length; i++) {
      const res = ambiguousResolutions[i];
      if (res && res !== "new") {
        const amb = diff.ambiguous[i];
        const candidate = amb.candidates.find((c) => c.id === res);
        if (candidate) {
          updates.push({
            id: candidate.id,
            email: amb.incoming.email,
            birthDate: amb.incoming.birthDate,
            isBaptized: amb.incoming.isBaptized,
            reactivate: candidate.status === "moved",
          });
        }
      }
    }

    return { inserts, moves, updates, merges };
  }

  function handleConfirm() {
    if (plan.step !== "preview") return;
    const resolvedPlan = buildResolvedPlan();
    startTransition(async () => {
      try {
        const summary = await commitSync(resolvedPlan);
        setPlan({ step: "done", summary });
      } catch (e) {
        setError(
          e instanceof Error ? e.message : "Failed to commit sync.",
        );
      }
    });
  }

  function handleCancel() {
    setPlan({ step: "idle" });
    setAmbiguousResolutions({});
    setNameChangeResolutions({});
    setError(null);
  }

  function handleSyncAgain() {
    setPlan({ step: "idle" });
    setRawText("");
    setError(null);
  }

  function handleCopyScript() {
    navigator.clipboard.writeText(LCR_SCRIPT);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  // --- Idle state ---
  if (plan.step === "idle") {
    return (
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="json-input">Paste the copied JSON array here</Label>
          <Textarea
            id="json-input"
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
            placeholder='[{"firstName":"John","lastName":"Doe","gender":"male","birthDate":"1990-01-15","email":"john@example.com","isBaptized":true}]'
            className="h-48 resize-none overflow-y-auto font-mono text-xs"
          />
        </div>
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <div className="flex items-center gap-2">
          <Button onClick={handleSync} disabled={isPending || !rawText.trim()}>
            {isPending ? "Syncing…" : "Sync"}
          </Button>
          <Button variant="outline" onClick={handleCopyScript}>
            {copied ? (
              <IconCheck data-icon="inline-start" />
            ) : (
              <IconCopy data-icon="inline-start" />
            )}
            {copied ? "Copied!" : "Copy script"}
          </Button>
        </div>
      </div>
    );
  }

  // --- Preview state ---
  if (plan.step === "preview") {
    const { diff } = plan;
    return (
      <div className="flex flex-col gap-6">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <PreviewSection
          title="New members"
          badgeText={diff.new.length}
          badgeVariant="default"
          emptyText="No new members."
        >
          <div className="flex flex-col gap-1">
            {diff.new.map((m, i) => (
              <MemberRow key={i} member={m} />
            ))}
          </div>
        </PreviewSection>

        <PreviewSection
          title="Moved out"
          badgeText={diff.moved.length}
          badgeVariant="destructive"
          emptyText="No members moved out."
        >
          <div className="flex flex-col gap-1">
            {diff.moved.map((m) => (
              <ExistingMemberRow key={m.id} member={m} />
            ))}
          </div>
        </PreviewSection>

        <PreviewSection
          title="Updated"
          badgeText={diff.updated.length}
          badgeVariant="secondary"
          emptyText="No updates."
        >
          <div className="flex flex-col gap-3">
            {diff.updated.map((u, i) => (
              <div key={i} className="flex flex-col gap-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">
                    {u.incoming.firstName} {u.incoming.lastName}
                  </span>
                  {u.reactivate && (
                    <Badge variant="outline">reactivate</Badge>
                  )}
                </div>
                <FieldChangeList changes={u.changes} />
              </div>
            ))}
          </div>
        </PreviewSection>

        {diff.unchanged.length > 0 && (
          <PreviewSection
            title="Unchanged"
            badgeText={diff.unchanged.length}
            badgeVariant="outline"
            emptyText=""
          >
            <p className="text-sm text-muted-foreground">
              {diff.unchanged
                .map((u) => `${u.first_name} ${u.last_name}`)
                .join(", ")}
            </p>
          </PreviewSection>
        )}

        {diff.ambiguous.length > 0 && (
          <PreviewSection
            title="Ambiguous — resolve required"
            badgeText={diff.ambiguous.length}
            badgeVariant="destructive"
            emptyText=""
          >
            <div className="flex flex-col gap-4">
              {diff.ambiguous.map((amb, i) => (
                <div key={i} className="flex flex-col gap-2">
                  <div className="text-sm font-medium">
                    {amb.incoming.firstName} {amb.incoming.lastName}
                    {amb.incoming.birthDate && (
                      <span className="text-muted-foreground">
                        {" "}
                        — born {amb.incoming.birthDate}
                      </span>
                    )}
                  </div>
                  <RadioGroup
                    value={ambiguousResolutions[i] ?? ""}
                    onValueChange={(v) =>
                      setAmbiguousResolutions((prev) => ({
                        ...prev,
                        [i]: v,
                      }))
                    }
                  >
                    <div className="flex flex-col gap-1">
                      {amb.candidates.map((c) => (
                        <div
                          key={c.id}
                          className="flex items-center gap-2"
                        >
                          <RadioGroupItem value={c.id} id={`amb-${i}-${c.id}`} />
                          <Label htmlFor={`amb-${i}-${c.id}`} className="text-sm font-normal">
                            {c.first_name} {c.last_name}
                            {c.birth_date && ` — born ${c.birth_date}`}
                            {c.gender && ` (${c.gender})`}
                            {c.status === "moved" && (
                              <Badge variant="outline" className="ml-2">moved</Badge>
                            )}
                          </Label>
                        </div>
                      ))}
                      <div className="flex items-center gap-2">
                        <RadioGroupItem value="new" id={`amb-${i}-new`} />
                        <Label htmlFor={`amb-${i}-new`} className="text-sm font-normal">
                          Insert as new member
                        </Label>
                      </div>
                    </div>
                  </RadioGroup>
                </div>
              ))}
            </div>
          </PreviewSection>
        )}

        {diff.possibleNameChanges.length > 0 && (
          <PreviewSection
            title="Possible name changes"
            badgeText={diff.possibleNameChanges.length}
            badgeVariant="secondary"
            emptyText=""
          >
            <div className="flex flex-col gap-4">
              {diff.possibleNameChanges.map((pc, i) => (
                <div key={i} className="flex flex-col gap-2">
                  <div className="text-sm">
                    <span className="font-medium">
                      {pc.incoming.firstName} {pc.incoming.lastName}
                    </span>
                    <span className="text-muted-foreground"> could be </span>
                    <span className="font-medium">
                      {pc.movedMember.first_name} {pc.movedMember.last_name}
                    </span>
                    {pc.incoming.birthDate && (
                      <span className="text-muted-foreground">
                        {" "}
                        — born {pc.incoming.birthDate} ({pc.incoming.gender})
                      </span>
                    )}
                  </div>
                  <RadioGroup
                    value={nameChangeResolutions[i] ?? "separate"}
                    onValueChange={(v) =>
                      setNameChangeResolutions((prev) => ({
                        ...prev,
                        [i]: v as "merge" | "separate",
                      }))
                    }
                  >
                    <div className="flex gap-4">
                      <div className="flex items-center gap-2">
                        <RadioGroupItem value="separate" id={`nc-${i}-separate`} />
                        <Label htmlFor={`nc-${i}-separate`} className="text-sm font-normal">
                          Keep separate
                        </Label>
                      </div>
                      <div className="flex items-center gap-2">
                        <RadioGroupItem value="merge" id={`nc-${i}-merge`} />
                        <Label htmlFor={`nc-${i}-merge`} className="text-sm font-normal">
                          Confirm merge
                        </Label>
                      </div>
                    </div>
                  </RadioGroup>
                </div>
              ))}
            </div>
          </PreviewSection>
        )}

        <div className="flex items-center gap-2">
          <Button
            onClick={handleConfirm}
            disabled={isPending || !allAmbiguousResolved}
          >
            {isPending ? "Committing…" : "Confirm"}
          </Button>
          <Button variant="outline" onClick={handleCancel} disabled={isPending}>
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  // --- Done state ---
  const { summary } = plan;
  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <Badge variant="default">{summary.added} added</Badge>
          <Badge variant="destructive">{summary.moved} moved</Badge>
          <Badge variant="secondary">{summary.updated} updated</Badge>
        </div>
      </div>
      <Button onClick={handleSyncAgain} variant="outline">
        Sync again
      </Button>
    </div>
  );
}

function PreviewSection({
  title,
  badgeText,
  badgeVariant,
  emptyText,
  children,
}: {
  title: string;
  badgeText: number;
  badgeVariant: "default" | "secondary" | "destructive" | "outline";
  emptyText: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <h3 className="text-sm font-semibold">{title}</h3>
        <Badge variant={badgeVariant}>{badgeText}</Badge>
      </div>
      {badgeText === 0 && emptyText ? (
        <p className="text-sm text-muted-foreground">{emptyText}</p>
      ) : (
        children
      )}
    </div>
  );
}

function MemberRow({ member }: { member: IncomingMember }) {
  return (
    <div className="text-sm">
      {member.firstName} {member.lastName}
      {member.birthDate && (
        <span className="text-muted-foreground"> — born {member.birthDate}</span>
      )}
      {member.gender && (
        <span className="text-muted-foreground"> ({member.gender})</span>
      )}
    </div>
  );
}

function ExistingMemberRow({ member }: { member: ExistingMember }) {
  return (
    <div className="text-sm">
      {member.first_name} {member.last_name}
      {member.birth_date && (
        <span className="text-muted-foreground"> — born {member.birth_date}</span>
      )}
      {member.gender && (
        <span className="text-muted-foreground"> ({member.gender})</span>
      )}
    </div>
  );
}

function FieldChangeList({ changes }: { changes: FieldChanges }) {
  const entries = Object.entries(changes);
  if (entries.length === 0) {
    return <p className="text-sm text-muted-foreground">No field changes.</p>;
  }
  return (
    <div className="flex flex-col gap-0.5 pl-4">
      {entries.map(([field, change]) => (
        <div key={field} className="text-xs text-muted-foreground">
          <span className="font-mono">{field}</span>:{" "}
          <span>{String(change.from) || "∅"}</span>
          {" → "}
          <span>{String(change.to) || "∅"}</span>
        </div>
      ))}
    </div>
  );
}
