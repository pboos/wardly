"use client";

import { IconCheck } from "@tabler/icons-react";
import { cn } from "@/lib/utils";
import type { TaskStateDef } from "@/lib/tasks/types";

/**
 * Low-level progress ring.
 *
 * - `progress <= 0`  → dashed outline in `color`, no inner shape ("not started")
 * - `0 < progress < 1` → solid outline + a single pie slice filled with
 *   `color` representing the active progress percentage
 * - `progress >= 1` → fully filled circle in `color` with a white checkmark
 */
export function StatusProgressIcon({
  color,
  progress,
  size = 18,
  className,
}: {
  color: string;
  progress: number;
  size?: number;
  className?: string;
}) {
  const clamped = Math.max(0, Math.min(1, progress));

  if (clamped >= 1) {
    return (
      <span
        className={cn("inline-flex items-center justify-center", className)}
        style={{ width: size, height: size }}
        aria-hidden
      >
        <span
          className="inline-flex items-center justify-center rounded-full"
          style={{ width: size, height: size, backgroundColor: color }}
        >
          <IconCheck
            className="text-white"
            style={{ width: size * 0.6, height: size * 0.6 }}
            strokeWidth={3}
          />
        </span>
      </span>
    );
  }

  if (clamped <= 0) {
    return (
      <span
        className={cn("inline-flex items-center justify-center", className)}
        style={{ width: size, height: size }}
        aria-hidden
      >
        <span
          className="inline-block rounded-full"
          style={{ width: size, height: size, border: `1.5px dashed ${color}` }}
        />
      </span>
    );
  }

  const stroke = 1.5;
  const cx = size / 2;
  const cy = size / 2;
  const outerR = (size - stroke) / 2;
  const innerR = Math.max(outerR - stroke - 0.5, 0.5);
  const startAngle = -Math.PI / 2;
  const endAngle = startAngle + clamped * 2 * Math.PI;
  const x1 = cx + innerR * Math.cos(startAngle);
  const y1 = cy + innerR * Math.sin(startAngle);
  const x2 = cx + innerR * Math.cos(endAngle);
  const y2 = cy + innerR * Math.sin(endAngle);
  const largeArc = clamped > 0.5 ? 1 : 0;
  const path = `M ${cx} ${cy} L ${x1.toFixed(3)} ${y1.toFixed(3)} A ${innerR} ${innerR} 0 ${largeArc} 1 ${x2.toFixed(3)} ${y2.toFixed(3)} Z`;

  return (
    <span
      className={cn("inline-flex items-center justify-center", className)}
      style={{ width: size, height: size }}
      aria-hidden
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={cx} cy={cy} r={outerR} fill="transparent" stroke={color} strokeWidth={stroke} />
        <path d={path} fill={color} />
      </svg>
    </span>
  );
}

/**
 * Wrapper around `StatusProgressIcon` that pulls `color` and
 * `progress_percentage` from a `TaskStateDef`. Use this everywhere a task
 * state is visualised so the colour/progress mapping stays in one place.
 */
export function TaskStateIcon({
  stateDef,
  size,
  className,
}: {
  stateDef: TaskStateDef;
  size?: number;
  className?: string;
}) {
  return (
    <StatusProgressIcon
      color={stateDef.color}
      progress={stateDef.progress_percentage}
      size={size}
      className={className}
    />
  );
}
