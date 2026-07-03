"use client";

import { cn } from "@/lib/utils";

function formatMs(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function CountdownRing({
  remainingMs,
  progress,
  elapsed,
}: {
  remainingMs: number;
  progress: number;
  elapsed: boolean;
}) {
  const size = 160;
  const stroke = 10;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const dash = circumference * (elapsed ? 0 : progress);

  return (
    <div className="flex items-center justify-center py-2">
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="-rotate-90"
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          className="stroke-muted"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          className={cn(
            elapsed ? "stroke-destructive" : "stroke-primary",
            "transition-[stroke-dashoffset] duration-200 ease-linear",
          )}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference - dash}
        />
      </svg>
      <span className="absolute text-3xl font-semibold tabular-nums">
        {elapsed ? "0:00" : formatMs(remainingMs)}
      </span>
    </div>
  );
}
