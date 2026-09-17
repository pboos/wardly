import assert from "node:assert/strict";
import { test } from "node:test";
import vm from "node:vm";
import { LCR_SCRIPT } from "./lcr-script.ts";

const member = {
  uuid: "fictional-member",
  householdUuid: "fictional-household",
  householdRole: "HEAD",
  nameFormats: { listPreferredLocal: "Example, Alex" },
  sex: "MALE",
  birthDateSort: "2000-02-29",
  statusFlags: { baptizedAndConfirmed: true },
};
const another = {
  ...member,
  uuid: "another-member",
  nameFormats: { listPreferredLocal: "Other, Jamie" },
};
function fiber(props = null) {
  return {
    tag: 0,
    memoizedProps: props,
    memoizedState: null,
    child: null,
    sibling: null,
    return: null,
  };
}
function setup(props, options = {}) {
  const root = fiber();
  root.tag = 3;
  root.stateNode = { current: root };
  root.child = fiber(props);
  root.child.return = root;
  const oldRoot = fiber({ members: [{ ...member, uuid: "stale" }] });
  oldRoot.stateNode = root.stateNode;
  root.alternate = oldRoot;
  const messages = [];
  let copied = null;
  class Node {}
  const element = new Node();
  element.__reactFiber$test = options.staleAttachment ? oldRoot : root.child;
  const context = vm.createContext({
    location: {
      origin: "https://lcr.churchofjesuschrist.org",
      pathname: "/mlt/records/member-list",
    },
    document: { querySelectorAll: () => [element] },
    Node,
    TextEncoder,
    copy: options.noCopy
      ? undefined
      : (text) => {
          copied = text;
        },
    fetch: () => {
      throw new Error("Must not fetch");
    },
    console: {
      log: (...args) => messages.push(args),
      error: (...args) => messages.push(args),
    },
  });
  context.window = context;
  return {
    context,
    root,
    messages,
    copied: () => copied,
    run: () => vm.runInContext(LCR_SCRIPT, context),
  };
}

test("exports 343 loaded members in one paste and omits unknown email", () => {
  const members = Array.from({ length: 343 }, (_, i) => ({
    ...member,
    uuid: `fictional-${i}`,
  }));
  const browser = setup({ members });
  browser.run();
  assert.equal(browser.context.wardlyLcr.status, "ready");
  assert.equal(browser.context.wardlyLcr.count, 343);
  const exported = JSON.parse(browser.copied());
  assert.equal(exported.length, 343);
  assert.equal(exported[0].firstName, "Alex");
  assert.equal(exported[0].birthDate, "2000-02-29");
  assert.equal(exported[0].isBaptized, true);
  assert.equal(Object.hasOwn(exported[0], "email"), false);
  assert.equal(exported[0].externalHouseholdUuid, member.householdUuid);
});

test("uses committed tree when DOM references old fiber, and reads hook state", () => {
  const browser = setup(null, { staleAttachment: true });
  browser.root.child.memoizedState = {
    memoizedState: { data: { members: [member] } },
    next: null,
  };
  browser.run();
  assert.equal(JSON.parse(browser.copied())[0].externalUuid, member.uuid);
});

test("accepts repeated lists, reordered lists and identical subsets", () => {
  const browser = setup({
    full: [member, another],
    filtered: [another],
    repeat: [another, member],
  });
  browser.run();
  assert.equal(browser.context.wardlyLcr.count, 2);
});

test("skips getters, cycles, old alternates and member subgraphs", () => {
  const props = {
    members: [
      {
        ...member,
        address: {
          get unexpected() {
            throw new Error("getter");
          },
        },
      },
    ],
  };
  props.self = props;
  Object.defineProperty(props, "getter", {
    get() {
      throw new Error("getter");
    },
  });
  const browser = setup(props);
  browser.run();
  assert.equal(browser.context.wardlyLcr.status, "ready");
});

test("preserves supplied email/null and prints fallback when copy is unavailable", () => {
  for (const email of ["alex@example.test", null]) {
    const browser = setup(
      { members: [{ ...member, email }] },
      { noCopy: true },
    );
    browser.run();
    assert.equal(JSON.parse(browser.context.wardlyLcr.json)[0].email, email);
    assert.ok(
      browser.messages.some(
        ([message]) =>
          typeof message === "string" &&
          message.includes("copy(wardlyLcr.json)"),
      ),
    );
  }
});

test("rejects conflicting lists, duplicate IDs, missing data and invalid fields", () => {
  for (const props of [
    { a: [member], b: [another] },
    { a: [member], b: [{ ...member, email: "changed@example.test" }] },
    { members: [member, member] },
    { members: [] },
    {},
    ...[
      { birthDateSort: "2001-02-29" },
      { birthDateSort: undefined },
      { email: 123 },
      { sex: "UNKNOWN" },
      { uuid: "" },
      { statusFlags: { baptizedAndConfirmed: "false" } },
    ].map((overrides) => ({ members: [{ ...member, ...overrides }] })),
  ]) {
    const browser = setup(props);
    browser.context.wardlyLcr = { json: "stale" };
    browser.run();
    assert.equal(browser.context.wardlyLcr.status, "error");
    assert.equal(browser.context.wardlyLcr.json, null);
    assert.equal(browser.copied(), null);
  }
});

test("fails closed when the scan budget is exhausted", () => {
  let chain = {};
  for (let i = 0; i < 200001; i++) chain = { next: chain };
  const browser = setup({ chain, members: [member] });
  browser.run();
  assert.equal(browser.context.wardlyLcr.json, null);
  assert.ok(
    browser.messages.some(
      ([message]) =>
        typeof message === "string" &&
        message.includes("scan reached its limit"),
    ),
  );
});

test("rejects another site or another LCR page", () => {
  for (const location of [
    { origin: "https://example.test", pathname: "/mlt/records/member-list" },
    { origin: "https://lcr.churchofjesuschrist.org", pathname: "/" },
  ]) {
    const browser = setup({ members: [member] });
    browser.context.location = location;
    assert.throws(browser.run, /Open the LCR member list/);
  }
});

test("exports member 215 with missing baptism without dropping them or inventing false", () => {
  for (const statusFlags of [
    undefined,
    null,
    {},
    { baptizedAndConfirmed: null },
  ]) {
    const members = Array.from({ length: 343 }, (_, i) => ({
      ...member,
      uuid: `member-${i}`,
    }));
    members[214] = { ...members[214], statusFlags };
    const browser = setup({ members });
    browser.run();
    const exported = JSON.parse(browser.copied());
    assert.equal(exported.length, 343);
    assert.equal(Object.hasOwn(exported[214], "isBaptized"), false);
    assert.equal(exported[213].isBaptized, true);
    assert.ok(
      browser.messages.some(
        ([message]) =>
          typeof message === "string" &&
          message.includes("1 members have no baptism flag"),
      ),
    );
  }
});

test("exports an explicit false baptism flag unchanged", () => {
  const browser = setup({
    members: [{ ...member, statusFlags: { baptizedAndConfirmed: false } }],
  });
  browser.run();
  assert.equal(JSON.parse(browser.copied())[0].isBaptized, false);
});

test("retains all source fields and future nested data alongside normalized fields", () => {
  const source = {
    ...member,
    phone: "+41 00 000 00 00",
    address: { lines: ["Example Street 1"], postalCode: "0000" },
    age: 26,
    associatedOrgUuids: ["fictional-org"],
    birthDateDisplay: "29 Feb 2000",
    currentUnitName: "Example Ward",
    priesthoodOffice: null,
    nameFormats: {
      ...member.nameFormats,
      spokenPreferredLocal: "Alex",
      listPreferredSort: "Example, Alex",
    },
    statusFlags: { ...member.statusFlags, adult: true, outOfUnit: false },
    futureField: { values: [false, 0, "", null], nested: { code: "new" } },
    firstName: "Source value must not override Wardly mapping",
  };
  const browser = setup({ members: [source] });
  browser.run();
  const exported = JSON.parse(browser.copied())[0];
  assert.deepEqual(exported.lcr, source);
  assert.equal(exported.firstName, "Alex");
  assert.equal(exported.externalUuid, source.uuid);
  assert.equal(exported.externalHouseholdRole, source.householdRole);
  assert.equal(
    source.firstName,
    "Source value must not override Wardly mapping",
  );
});

test("source key order does not create false conflicts, but different source values do", () => {
  const source = {
    ...member,
    phone: "123",
    address: { city: "Example", country: "CH" },
  };
  const reordered = Object.fromEntries(Object.entries(source).reverse());
  reordered.address = { country: "CH", city: "Example" };
  const browser = setup({ full: [source], repeat: [reordered] });
  browser.run();
  assert.equal(browser.context.wardlyLcr.status, "ready");
  const conflict = setup({
    full: [source],
    repeat: [{ ...source, phone: "456" }],
  });
  conflict.run();
  assert.equal(conflict.context.wardlyLcr.status, "error");
  assert.equal(conflict.copied(), null);
});

test("snapshots JSON data without running getters or serialization hooks", () => {
  const source = {
    ...member,
    optional: undefined,
    callback() {
      throw new Error("callback");
    },
  };
  Object.defineProperty(source, "computed", {
    enumerable: true,
    get() {
      throw new Error("getter");
    },
  });
  const browser = setup({ members: [source] });
  browser.run();
  assert.deepEqual(JSON.parse(browser.copied())[0].lcr, member);
  const cyclic = { ...member };
  cyclic.self = cyclic;
  const failure = setup({ members: [cyclic] });
  failure.run();
  assert.equal(failure.context.wardlyLcr.status, "error");
  assert.equal(failure.copied(), null);
});

test("full source records can exceed the former 1 MB limit but not 5 MB", () => {
  for (const [length, expected] of [
    [1_100_000, "ready"],
    [5_000_000, "error"],
  ]) {
    const browser = setup({
      members: [{ ...member, futureField: "x".repeat(length) }],
    });
    browser.run();
    assert.equal(browser.context.wardlyLcr.status, expected);
    assert.equal(browser.copied() !== null, expected === "ready");
  }
});
