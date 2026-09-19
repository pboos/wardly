"use client";

import { Checkbox } from "@/components/ui/checkbox";

export function MemberSelection({
  label,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  checked: boolean | "indeterminate";
  disabled?: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <Checkbox
      aria-label={label}
      checked={checked}
      disabled={disabled}
      onCheckedChange={(value) => onChange(value === true)}
    />
  );
}
