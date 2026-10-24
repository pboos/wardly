type Snapshot = { instructions: string };
export function canMergeInstructions(
  a: Snapshot,
  b: Snapshot,
  defaults: string[],
) {
  return (
    a.instructions === b.instructions ||
    defaults.includes(a.instructions) ||
    defaults.includes(b.instructions)
  );
}
export function mergedInstructions(
  a: Snapshot,
  b: Snapshot,
  defaults: string[],
) {
  return defaults.includes(a.instructions) && !defaults.includes(b.instructions)
    ? b.instructions
    : a.instructions;
}
