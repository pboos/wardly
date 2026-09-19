"use client";

import { useState } from "react";

export function useMemberSelection(scope: string, visibleIds: string[]) {
  const visibleKey = JSON.stringify(visibleIds);
  const [state, setState] = useState({
    scope,
    visibleKey,
    ids: [] as string[],
  });
  // Clear when filters change; prune members that disappear after refreshed data.
  // Updating during render prevents a stale selection from reaching the toolbar.
  let ids = state.ids;
  if (state.scope !== scope || state.visibleKey !== visibleKey) {
    ids =
      state.scope === scope
        ? state.ids.filter((id) => visibleIds.includes(id))
        : [];
    setState({ scope, visibleKey, ids });
  }
  return {
    selectedIds: ids,
    setSelectedIds: (ids: string[]) => setState({ scope, visibleKey, ids }),
    toggleMember: (id: string, checked: boolean) =>
      setState((previous) => ({
        scope,
        visibleKey,
        ids: checked
          ? [...new Set([...previous.ids, id])]
          : previous.ids.filter((value) => value !== id),
      })),
  };
}
