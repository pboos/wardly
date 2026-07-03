"use client";

import { useSyncExternalStore } from "react";

const STORAGE_KEY = "wardly.bishopric-meeting.muted";

let state = false;
let initialized = false;
const listeners = new Set<() => void>();

function init(): void {
  if (initialized || typeof window === "undefined") return;
  initialized = true;
  try {
    state = window.localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    // keep default
  }
}

function subscribe(listener: () => void): () => void {
  init();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): boolean {
  init();
  return state;
}

function getServerSnapshot(): boolean {
  return false;
}

export function setMuted(next: boolean): void {
  state = next;
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
    } catch {
      // ignore
    }
  }
  for (const l of listeners) l();
}

export function useMuted(): [boolean, (next: boolean) => void] {
  const muted = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return [muted, setMuted];
}
