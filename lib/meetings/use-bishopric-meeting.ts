"use client";

import { useSyncExternalStore } from "react";
import {
  BISHOPRIC_DEFAULT_ITEMS,
  type MeetingItem,
} from "./bishopric-defaults";

export type StoredItem = MeetingItem;

export type MeetingState = {
  items: StoredItem[];
  completedIds: string[];
};

const STORAGE_KEY = "wardly.bishopric-meeting.v1";

const DEFAULT_STATE: MeetingState = {
  items: BISHOPRIC_DEFAULT_ITEMS,
  completedIds: [],
};

let state: MeetingState = DEFAULT_STATE;
let initialized = false;
const listeners = new Set<() => void>();

function isStoredItem(value: unknown): value is StoredItem {
  return (
    value !== null &&
    typeof value === "object" &&
    typeof (value as StoredItem).id === "string" &&
    typeof (value as StoredItem).name === "string" &&
    typeof (value as StoredItem).durationMin === "number"
  );
}

function init(): void {
  if (initialized || typeof window === "undefined") return;
  initialized = true;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as Partial<MeetingState>;
    const items = Array.isArray(parsed.items)
      ? parsed.items.filter(isStoredItem)
      : DEFAULT_STATE.items;
    const completedIds = Array.isArray(parsed.completedIds)
      ? parsed.completedIds.filter(
          (id): id is string => typeof id === "string",
        )
      : [];
    state = { items, completedIds };
  } catch {
    // keep defaults
  }
}

function persist(next: MeetingState): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // ignore quota / private mode
  }
}

function setState(next: MeetingState): void {
  state = next;
  persist(next);
  for (const l of listeners) l();
}

function genId(): string {
  return `item-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

export function subscribe(listener: () => void): () => void {
  init();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getSnapshot(): MeetingState {
  init();
  return state;
}

export function getServerSnapshot(): MeetingState {
  return DEFAULT_STATE;
}

export function addItem(name: string, durationMin: number): void {
  const trimmed = name.trim();
  if (!trimmed || durationMin <= 0) return;
  setState({
    ...state,
    items: [...state.items, { id: genId(), name: trimmed, durationMin }],
  });
}

export function updateItem(
  id: string,
  patch: Partial<Pick<StoredItem, "name" | "durationMin">>,
): void {
  setState({
    ...state,
    items: state.items.map((it) =>
      it.id === id
        ? {
            ...it,
            name:
              patch.name !== undefined
                ? patch.name.trim() || it.name
                : it.name,
            durationMin:
              patch.durationMin !== undefined
                ? patch.durationMin > 0
                  ? patch.durationMin
                  : it.durationMin
                : it.durationMin,
          }
        : it,
    ),
  });
}

export function removeItem(id: string): void {
  setState({
    items: state.items.filter((it) => it.id !== id),
    completedIds: state.completedIds.filter((cid) => cid !== id),
  });
}

export function moveItem(fromIndex: number, toIndex: number): void {
  if (
    fromIndex === toIndex ||
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= state.items.length ||
    toIndex >= state.items.length
  ) {
    return;
  }
  const next = [...state.items];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  setState({ ...state, items: next });
}

export function reset(): void {
  setState({
    items: [...BISHOPRIC_DEFAULT_ITEMS],
    completedIds: [],
  });
}

export function markDone(id: string): void {
  if (state.completedIds.includes(id)) return;
  setState({ ...state, completedIds: [...state.completedIds, id] });
}

export function unmarkDone(id: string): void {
  setState({
    ...state,
    completedIds: state.completedIds.filter((cid) => cid !== id),
  });
}

export function clearCompleted(): void {
  setState({ ...state, completedIds: [] });
}

export function useBishopricMeeting() {
  const snapshot = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot,
  );
  return {
    ...snapshot,
    addItem,
    updateItem,
    removeItem,
    moveItem,
    reset,
    markDone,
    unmarkDone,
    clearCompleted,
  };
}
