import test from "node:test";
import assert from "node:assert/strict";
import { createMeetingAlarm } from "../meetings/play-alarm.ts";

test("alarm primes one reusable context before expiry and schedules sound only when running", async () => {
  let created = 0,
    resumed = 0,
    beeps = 0,
    closed = 0;
  let context;
  class AudioContext {
    state = "suspended";
    currentTime = 2;
    destination = {};
    constructor() {
      created++;
      context = new WeakRef(this);
    }
    async resume() {
      resumed++;
      this.state = "running";
    }
    async close() {
      closed++;
      this.state = "closed";
    }
    createOscillator() {
      return {
        frequency: {},
        connect: (gain) => gain,
        start: () => beeps++,
        stop() {},
        disconnect() {},
      };
    }
    createGain() {
      return {
        gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {} },
        connect() {},
        disconnect() {},
      };
    }
  }
  const previous = globalThis.window;
  globalThis.window = { AudioContext };
  try {
    const alarm = createMeetingAlarm();
    assert.equal(alarm.play(), false);
    const primed = alarm.prime();
    assert.equal(created, 1);
    assert.equal(resumed, 1);
    assert.equal(beeps, 0);
    await primed;
    assert.equal(alarm.play(), true);
    assert.equal(beeps, 3);
    await alarm.prime();
    assert.equal(created, 1);
    context.deref().state = "suspended";
    assert.equal(alarm.play(), false);
    assert.equal(beeps, 3);
    alarm.dispose();
    assert.equal(closed, 1);
  } finally {
    globalThis.window = previous;
  }
});

test("alarm surfaces browser resume failures", async () => {
  const previous = globalThis.window;
  globalThis.window = {
    AudioContext: class {
      state = "suspended";
      async resume() {
        throw new Error("Blocked by browser");
      }
      async close() {}
    },
  };
  try {
    const alarm = createMeetingAlarm();
    await assert.rejects(alarm.prime(), /Blocked by browser/);
    assert.equal(alarm.play(), false);
    alarm.dispose();
  } finally {
    globalThis.window = previous;
  }
});
