"use client";
import { createContext, useContext, type ReactNode } from "react";
import type { SundayHymnData } from "@/lib/sunday-meetings/hymns";

const HymnContext = createContext<SundayHymnData>({ hymns: [], lastSung: {} });

export function SundayHymnProvider({
  data,
  children,
}: {
  data: SundayHymnData;
  children: ReactNode;
}) {
  return <HymnContext value={data}>{children}</HymnContext>;
}

export function useSundayHymns() {
  return useContext(HymnContext);
}
