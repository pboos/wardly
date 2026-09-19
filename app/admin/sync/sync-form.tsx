"use client";

import { FieldChangeList } from "./field-change-list";
import { ExistingMemberRow } from "./existing-member-row";
import { MemberRow } from "./member-row";
import { PreviewSection } from "./preview-section";

import { useTransition, useState } from "react";
import { IconCopy, IconCheck } from "@tabler/icons-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Textarea } from "@/components/ui/textarea";
import { Field, FieldLabel } from "@/components/ui/field";
import { LCR_SCRIPT } from "./lcr-script";
import {
  parseSync,
  commitSync,
  type SyncDiff,
  type ResolvedPlan,
} from "./actions";

type Plan =
  | { step: "idle" }
  | { step: "preview"; diff: SyncDiff }
  | {
      step: "done";
      summary: { added: number; moved: number; updated: number };
    };

export function SyncForm() {
  const [plan, setPlan] = useState<Plan>({ step: "idle" });
  const [rawText, setRawText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isPending, startTransition] = useTransition();
  function handleSync() {
    setError(null);
    startTransition(async () => {
      const result = await parseSync(rawText);
      if ("error" in result) {
        setError(result.error);
        return;
      }
      setPlan({ step: "preview", diff: result });
    });
  }

  function buildResolvedPlan(): ResolvedPlan {
    if (plan.step !== "preview") return { inserts: [], moves: [], updates: [] };
    return {
      inserts: plan.diff.new,
      moves: plan.diff.moved.map((member) => member.id),
      updates: plan.diff.updated.map(({ existing, incoming, reactivate }) => ({
        ...incoming,
        id: existing.id,
        reactivate,
      })),
    };
  }

  function handleConfirm() {
    if (plan.step !== "preview") return;
    const resolvedPlan = buildResolvedPlan();
    startTransition(async () => {
      try {
        const summary = await commitSync(resolvedPlan);
        setPlan({ step: "done", summary });
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to commit sync.");
      }
    });
  }

  function handleCancel() {
    setPlan({ step: "idle" });
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
        <Field>
          <FieldLabel htmlFor="json-input">
            Paste the copied JSON array here
          </FieldLabel>
          <Textarea
            id="json-input"
            value={rawText}
            onChange={(e) => setRawText(e.target.value)}
            placeholder='[{"externalUuid":"member-uuid","firstName":"John","lastName":"Doe","gender":"male","birthDate":"1990-01-15","email":"john@example.com","isBaptized":true}]'
            className="h-48 resize-none overflow-y-auto font-mono text-xs"
          />
        </Field>
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <div className="flex flex-wrap items-center gap-2">
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
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium">
                    {u.incoming.firstName} {u.incoming.lastName}
                  </span>
                  {u.reactivate && (
                    <Badge variant="outline">Returning · tags cleared</Badge>
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

        <div className="flex flex-wrap items-center gap-2">
          <Button onClick={handleConfirm} disabled={isPending}>
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
        <div className="flex flex-wrap items-center gap-2">
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
