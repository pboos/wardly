import assert from 'node:assert/strict';
import test from 'node:test';
import { sortTasksByProgress } from './sort.ts';

const types = [
  { type: 'z-key', name: 'Alpha', states: [
    { state: 'start', progress_percentage: 0 },
    { state: 'middle', progress_percentage: 0.5 },
  ] },
  { type: 'a-key', name: 'Beta', states: [
    { state: 'start', progress_percentage: 0 },
    { state: 'middle', progress_percentage: 0.75 },
    { state: 'tie', progress_percentage: 0.5 },
  ] },
];

test('sorts by actual progress descending, then display name; preserves ties and input', () => {
  const tasks = [
    { id: 'newer', type: 'z-key', state: 'start' },
    { id: 'beta-half', type: 'a-key', state: 'tie' },
    { id: 'alpha-half', type: 'z-key', state: 'middle' },
    { id: 'older', type: 'z-key', state: 'start' },
    { id: 'highest', type: 'a-key', state: 'middle' },
  ];
  const original = structuredClone(tasks);
  assert.deepEqual(sortTasksByProgress(tasks, types).map(t => t.id),
    ['highest', 'alpha-half', 'beta-half', 'newer', 'older']);
  assert.deepEqual(tasks, original);
  const changed = tasks.map(t => t.id === 'highest' ? {...t, state: 'start'} : t);
  assert.equal(sortTasksByProgress(changed, types)[0].id, 'alpha-half');
});

test('unknown states and types use zero progress and fall back to the type key', () => {
  const tasks = [
    { id: 'unknown-type', type: 'Zebra', state: 'middle' },
    { id: 'unknown-state', type: 'z-key', state: 'missing' },
    { id: 'known', type: 'a-key', state: 'start' },
  ];
  assert.deepEqual(sortTasksByProgress(tasks, types).map(t => t.id),
    ['unknown-state', 'known', 'unknown-type']);
  assert.deepEqual(sortTasksByProgress([], types), []);
});
