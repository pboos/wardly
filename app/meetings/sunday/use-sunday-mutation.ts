"use client";
import { useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

export type SundayMutationRunner = (
  action: () => Promise<unknown>,
  fallback: string,
) => void;

/** Keep actions and the refreshed server view in one pending transition. */
export function useSundayMutation() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const busy = useRef(false);
  const run: SundayMutationRunner = (action, fallback) => {
    if (busy.current || pending) return;
    busy.current = true;
    startTransition(async () => {
      try {
        await action();
        router.refresh();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : fallback, {
          action: { label: "Reload", onClick: () => router.refresh() },
        });
      } finally {
        busy.current = false;
      }
    });
  };
  return { pending, run };
}
