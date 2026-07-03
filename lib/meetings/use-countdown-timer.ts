"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type TimerStatus = "idle" | "running" | "elapsed";

export type TimerState = {
  itemId: string | null;
  endsAt: number;
  remainingMs: number;
  status: TimerStatus;
  isModalOpen: boolean;
};

const TICK_MS = 250;

const IDLE_STATE: TimerState = {
  itemId: null,
  endsAt: 0,
  remainingMs: 0,
  status: "idle",
  isModalOpen: false,
};

export function useCountdownTimer(onElapsed: () => void) {
  const [state, setState] = useState<TimerState>(IDLE_STATE);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const onElapsedRef = useRef(onElapsed);
  const stateRef = useRef(state);

  useEffect(() => {
    onElapsedRef.current = onElapsed;
  }, [onElapsed]);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  const clearTick = useCallback(() => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const startTicking = useCallback(
    (endsAt: number) => {
      clearTick();
      const tick = () => {
        const remaining = endsAt - Date.now();
        if (remaining <= 0) {
          clearTick();
          setState((prev) =>
            prev.itemId
              ? { ...prev, remainingMs: 0, status: "elapsed" }
              : prev,
          );
          onElapsedRef.current();
          return;
        }
        setState((prev) => ({ ...prev, remainingMs: remaining }));
      };
      tick();
      intervalRef.current = setInterval(tick, TICK_MS);
    },
    [clearTick],
  );

  const start = useCallback(
    (itemId: string, durationMin: number) => {
      const endsAt = Date.now() + Math.max(0, durationMin) * 60_000;
      setState({
        itemId,
        endsAt,
        remainingMs: endsAt - Date.now(),
        status: "running",
        isModalOpen: true,
      });
      startTicking(endsAt);
    },
    [startTicking],
  );

  const extend = useCallback(
    (minutes: number) => {
      const prev = stateRef.current;
      if (prev.itemId === null) return;
      const baseEndsAt = prev.status === "elapsed" ? Date.now() : prev.endsAt;
      const endsAt = baseEndsAt + minutes * 60_000;
      setState({
        ...prev,
        endsAt,
        remainingMs: endsAt - Date.now(),
        status: "running",
      });
      startTicking(endsAt);
    },
    [startTicking],
  );

  const stop = useCallback(() => {
    clearTick();
    setState(IDLE_STATE);
  }, [clearTick]);

  const closeModal = useCallback(() => {
    clearTick();
    setState(IDLE_STATE);
  }, [clearTick]);

  useEffect(() => {
    return () => {
      clearTick();
    };
  }, [clearTick]);

  return {
    state,
    start,
    stop,
    extend,
    closeModal,
  };
}
