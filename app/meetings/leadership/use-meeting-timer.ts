"use client";
import { useEffect, useRef, useState } from "react";
import { createMeetingAlarm } from "@/lib/meetings/play-alarm";
type Clock = {
  remainingMs: number;
  plannedMinutes: number;
  extensionMinutes: number;
  runningSince: number | null;
  expiry: number;
};
function pauseClocks(current: Record<string, Clock>, time: number) {
  return Object.fromEntries(
    Object.entries(current).map(([id, clock]) => [
      id,
      clock.runningSince === null
        ? clock
        : {
            ...clock,
            remainingMs: clock.remainingMs - (time - clock.runningSince),
            runningSince: null,
          },
    ]),
  );
}
export function useMeetingTimer() {
  const [clocks, setClocks] = useState<Record<string, Clock>>({});
  const [muted, setMuted] = useState(false);
  const [soundError, setSoundError] = useState("");
  const [now, setNow] = useState(0);
  const alarm = useRef<ReturnType<typeof createMeetingAlarm> | null>(null);
  const sounded = useRef(new Set<string>());
  const running = Object.entries(clocks).find(
    ([, clock]) => clock.runningSince !== null,
  );
  const runningId = running?.[0];
  useEffect(() => () => alarm.current?.dispose(), []);
  useEffect(() => {
    if (!runningId) return;
    const interval = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(interval);
  }, [runningId]);
  const runningClock = running?.[1];
  const expired =
    !!runningClock &&
    runningClock.remainingMs - (now - (runningClock.runningSince ?? now)) <= 0;
  const expiry = runningClock?.expiry;
  useEffect(() => {
    if (!runningId || !expired) return;
    const key = `${runningId}:${expiry}`;
    if (sounded.current.has(key)) return;
    sounded.current.add(key);
    if (!muted && !alarm.current?.play())
      setSoundError("Alarm sound is unavailable. Use Test sound to enable it.");
  }, [runningId, expired, expiry, muted]);
  function primeSound() {
    alarm.current ??= createMeetingAlarm();
    void alarm.current.prime().then(
      () => setSoundError(""),
      (cause: unknown) =>
        setSoundError(
          cause instanceof Error ? cause.message : "Unable to enable sound.",
        ),
    );
  }
  return {
    remainingMs(id: string, minutes: number) {
      const clock = clocks[id];
      return clock
        ? clock.remainingMs -
            (clock.runningSince === null ? 0 : now - clock.runningSince)
        : minutes * 60000;
    },
    extension: (id: string) => clocks[id]?.extensionMinutes ?? 0,
    hasStarted: (id: string) => !!clocks[id],
    runningId,
    now,
    muted,
    soundError,
    primeSound,
    toggleMuted() {
      if (muted) primeSound();
      setMuted(!muted);
    },
    testSound() {
      alarm.current ??= createMeetingAlarm();
      void alarm.current.prime().then(
        () => {
          alarm.current?.play();
          setSoundError("");
        },
        (cause: unknown) =>
          setSoundError(
            cause instanceof Error ? cause.message : "Unable to play sound.",
          ),
      );
    },
    start(id: string, minutes: number) {
      const time = Date.now();
      setNow(time);
      setClocks((current) => {
        const paused = pauseClocks(current, time),
          clock = paused[id];
        return {
          ...paused,
          [id]: {
            remainingMs: clock
              ? clock.remainingMs + (minutes - clock.plannedMinutes) * 60000
              : minutes * 60000,
            plannedMinutes: minutes,
            extensionMinutes: clock?.extensionMinutes ?? 0,
            expiry: clock
              ? clock.expiry + (minutes !== clock.plannedMinutes ? 1 : 0)
              : 0,
            runningSince: time,
          },
        };
      });
    },
    pause() {
      const time = Date.now();
      setNow(time);
      setClocks((current) => pauseClocks(current, time));
    },
    extend(id: string, minutes: number, extension: number) {
      const time = Date.now();
      setNow(time);
      setClocks((current) => {
        const clock = current[id] ?? {
          remainingMs: minutes * 60000,
          plannedMinutes: minutes,
          extensionMinutes: 0,
          runningSince: null,
          expiry: 0,
        };
        const remaining =
          clock.remainingMs +
          (minutes - clock.plannedMinutes) * 60000 -
          (clock.runningSince === null ? 0 : time - clock.runningSince);
        return {
          ...current,
          [id]: {
            ...clock,
            plannedMinutes: minutes,
            remainingMs: Math.max(0, remaining) + extension * 60000,
            runningSince: clock.runningSince === null ? null : time,
            extensionMinutes: clock.extensionMinutes + extension,
            expiry: clock.expiry + 1,
          },
        };
      });
    },
    replan(id: string, minutes: number) {
      setClocks((current) => {
        const clock = current[id];
        return clock
          ? {
              ...current,
              [id]: {
                ...clock,
                remainingMs:
                  clock.remainingMs + (minutes - clock.plannedMinutes) * 60000,
                plannedMinutes: minutes,
                expiry:
                  clock.expiry + (minutes !== clock.plannedMinutes ? 1 : 0),
              },
            }
          : current;
      });
    },
    finish(id: string) {
      const time = Date.now();
      setNow(time);
      setClocks((current) => {
        const paused = pauseClocks(current, time);
        return current[id] ? { ...current, [id]: paused[id] } : current;
      });
    },
  };
}
export type MeetingTimer = ReturnType<typeof useMeetingTimer>;
export function formatTimer(milliseconds: number) {
  const seconds = Math.ceil(Math.abs(milliseconds) / 1000);
  return `${milliseconds < 0 ? "−" : ""}${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}
