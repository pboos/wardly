"use client";
import { useEffect, useState } from "react";
import { playAlarm } from "@/lib/meetings/play-alarm";
type Clock = {
  remainingMs: number;
  extensionMinutes: number;
  runningSince: number | null;
};
export function useMeetingTimer() {
  const [clocks, setClocks] = useState<Record<string, Clock>>({});
  const [muted, setMuted] = useState(false);
  const [now, setNow] = useState(0);
  const running = Object.entries(clocks).find(
    ([, clock]) => clock.runningSince !== null,
  );
  const runningId = running?.[0];
  useEffect(() => {
    if (!runningId) return;
    const tick = () => setNow(Date.now());
    const interval = setInterval(tick, 250);
    return () => clearInterval(interval);
  }, [runningId]);
  const runningClock = running?.[1];
  const remaining = runningClock
    ? runningClock.remainingMs - (now - (runningClock.runningSince ?? now))
    : 1;
  const elapsed = remaining <= 0;
  useEffect(() => {
    if (runningId && elapsed && !muted) playAlarm();
  }, [runningId, elapsed, muted]);
  function pauseAll(current: Record<string, Clock>, time: number) {
    return Object.fromEntries(
      Object.entries(current).map(([id, c]) => [
        id,
        c.runningSince === null
          ? c
          : {
              ...c,
              remainingMs: c.remainingMs - (time - c.runningSince),
              runningSince: null,
            },
      ]),
    );
  }
  return {
    remainingMs(id: string, minutes: number) {
      const c = clocks[id];
      return c
        ? c.remainingMs - (c.runningSince === null ? 0 : now - c.runningSince)
        : minutes * 60000;
    },
    extension(id: string) {
      return clocks[id]?.extensionMinutes ?? 0;
    },
    runningId,
    now,
    muted,
    toggleMuted() {
      setMuted((value) => !value);
    },
    start(id: string, minutes: number) {
      const time = Date.now();
      setNow(time);
      setClocks((current) => ({
        ...pauseAll(current, time),
        [id]: {
          ...(current[id] ?? {
            remainingMs: minutes * 60000,
            extensionMinutes: 0,
          }),
          runningSince: time,
        },
      }));
    },
    pause() {
      const time = Date.now();
      setNow(time);
      setClocks((current) => pauseAll(current, time));
    },
    extend(id: string, minutes: number, extension: number) {
      const time = Date.now();
      setNow(time);
      setClocks((current) => {
        const c = current[id] ?? {
          remainingMs: minutes * 60000,
          extensionMinutes: 0,
          runningSince: null,
        };
        return {
          ...current,
          [id]: {
            ...c,
            remainingMs:
              Math.max(
                0,
                c.remainingMs -
                  (c.runningSince === null ? 0 : time - c.runningSince),
              ) +
              extension * 60000,
            runningSince: c.runningSince === null ? null : time,
            extensionMinutes: c.extensionMinutes + extension,
          },
        };
      });
    },
    finish(id: string) {
      setClocks((current) => {
        const c = current[id];
        return c ? { ...current, [id]: { ...c, runningSince: null } } : current;
      });
    },
  };
}
export type MeetingTimer = ReturnType<typeof useMeetingTimer>;
export function formatTimer(milliseconds: number) {
  const seconds = Math.ceil(Math.abs(milliseconds) / 1000);
  return `${milliseconds < 0 ? "−" : ""}${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}
