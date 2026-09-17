import { MAX_SYNC_BYTES, MAX_SYNC_ROWS } from "./limits";

// Plain JavaScript for pasting into Chrome's console on the loaded LCR page.
// React internals are unsupported: fail clearly if their structure changes.
export const LCR_SCRIPT = String.raw`((copyToClipboard) => {
  if (location.origin !== "https://lcr.churchofjesuschrist.org" ||
      !/^\/mlt\/records\/member-list\/?$/.test(location.pathname)) {
    throw new Error("Open the LCR member list, wait for it to load, then paste the script again.");
  }
  window.wardlyLcr?.stop?.();
  const state = { json: null, count: 0, status: "scanning" };
  window.wardlyLcr = state;
  const read = (object, key) => object && Object.getOwnPropertyDescriptor(object, key)?.value;
  const isObject = value => value !== null && typeof value === "object";
  const isFiber = value => isObject(value) &&
    typeof read(value, "tag") === "number" && Object.hasOwn(value, "memoizedProps");
  let work = 0;
  function tick() {
    if (++work > 200000) throw new Error("The page scan reached its limit. Reload the full member list, wait for it to load, and try again. No export was created.");
  }

  function findMemberArrays() {
    // Resolve DOM-attached fibers to the committed tree; avoid old alternates.
    const roots = new Set();
    const rootCache = new Map();
    for (const element of document.querySelectorAll("*")) {
      tick();
      for (const key of Object.keys(element)) {
        if (!key.startsWith("__reactFiber$") && !key.startsWith("__reactContainer$")) continue;
        let fiber = read(element, key);
        if (!isFiber(fiber)) continue;
        const path = [];
        const ancestors = new Set();
        while (isFiber(fiber) && !rootCache.has(fiber)) {
          tick();
          if (ancestors.has(fiber)) throw new Error("Unsupported React tree. No export was created.");
          ancestors.add(fiber);
          path.push(fiber);
          const parent = read(fiber, "return");
          if (!parent) break;
          fiber = parent;
        }
        const root = rootCache.get(fiber) || read(read(fiber, "stateNode"), "current");
        if (!isFiber(root)) continue;
        roots.add(root);
        for (const item of path) rootCache.set(item, root);
      }
    }
    const data = [];
    const fibers = [...roots];
    const seenFibers = new WeakSet();
    while (fibers.length) {
      const fiber = fibers.pop();
      if (!isFiber(fiber) || seenFibers.has(fiber)) continue;
      tick();
      seenFibers.add(fiber);
      data.push(read(fiber, "memoizedProps"), read(fiber, "memoizedState"));
      fibers.push(read(fiber, "child"), read(fiber, "sibling"));
    }
    // Inspect data values only, without calling getters, callbacks or requests.
    const arrays = [];
    const seen = new WeakSet();
    const ignored = new Set(["_owner", "_debugOwner", "alternate", "stateNode"]);
    while (data.length) {
      const value = data.pop();
      if (!isObject(value) || value instanceof Node || value === window || isFiber(value) || seen.has(value)) continue;
      tick();
      seen.add(value);
      if (Array.isArray(value) && value.length && isObject(read(read(value, "0"), "nameFormats"))) {
        arrays.push(value);
        continue; // Do not traverse every member's unrelated data.
      }
      for (const [key, descriptor] of Object.entries(Object.getOwnPropertyDescriptors(value))) {
        if (!ignored.has(key) && "value" in descriptor && isObject(descriptor.value)) data.push(descriptor.value);
      }
    }
    return arrays;
  }

  // Snapshot all enumerable JSON data without invoking getters or toJSON hooks.
  // Sorted keys make repeated records comparable even if property order differs.
  function snapshot(value, ancestors = new Set(), depth = 0) {
    if (value === null || typeof value === "string" || typeof value === "boolean") return value;
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (["undefined", "function", "symbol"].includes(typeof value)) return undefined;
    if (!isObject(value)) throw new Error("Unsupported value in LCR source data. No export was created.");
    if (depth > 50 || ancestors.has(value)) throw new Error("Circular or overly deep LCR source data. No export was created.");
    const prototype = Object.getPrototypeOf(value);
    if (!Array.isArray(value) && prototype !== null && Object.getPrototypeOf(prototype) !== null) {
      throw new Error("Unsupported object in LCR source data. No export was created.");
    }
    const next = new Set([...ancestors, value]);
    if (Array.isArray(value)) {
      return Array.from({ length: value.length }, (_, index) => snapshot(read(value, String(index)), next, depth + 1) ?? null);
    }
    const result = Object.create(null);
    for (const key of Object.keys(value).sort()) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor || !("value" in descriptor)) continue;
      const item = snapshot(descriptor.value, next, depth + 1);
      if (item !== undefined) result[key] = item;
    }
    return result;
  }

  function mapMember(sourceMember, index) {
    const member = snapshot(sourceMember);
    const fail = field => { throw new Error("Member " + (index + 1) + ": missing or unsupported " + field + ". No export was created."); };
    if (typeof member?.uuid !== "string" || !member.uuid.trim()) fail("uuid");
    const name = member?.nameFormats?.listPreferredLocal;
    if (typeof name !== "string" || !name.trim()) fail("nameFormats.listPreferredLocal");
    if (!["MALE", "FEMALE"].includes(member.sex)) fail("sex");
    const baptism = member.statusFlags?.baptizedAndConfirmed;
    if (baptism != null && typeof baptism !== "boolean") fail("statusFlags.baptizedAndConfirmed (expected boolean or absent; received " + typeof baptism + ")");
    if (member.email != null && typeof member.email !== "string") fail("email");
    const birthDate = member.birthDateSort;
    if (birthDate !== null) {
      if (typeof birthDate !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(birthDate)) fail("birthDateSort (expected YYYY-MM-DD or null)");
      const date = new Date(birthDate + "T00:00:00Z");
      if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== birthDate) fail("birthDateSort");
    }
    for (const key of ["uuid", "householdUuid", "householdRole"]) {
      if (member[key] != null && typeof member[key] !== "string") fail(key);
    }
    const parts = name.split(",").map(part => part.trim());
    const firstName = parts.length > 1 ? parts.slice(1).join(", ") : parts[0];
    if (!firstName) fail("first name");
    return {
      externalUuid: member.uuid,
      externalHouseholdUuid: member.householdUuid,
      externalHouseholdRole: member.householdRole,
      firstName,
      lastName: parts.length > 1 ? parts[0] : "",
      gender: member.sex === "MALE" ? "m" : "f",
      birthDate,
      email: member.email,
      isBaptized: baptism ?? undefined,
      lcr: member,
    };
  }


  try {
    const arrays = findMemberArrays();
    if (!arrays.length) throw new Error("No loaded member list was found. Clear filters, wait until members appear, and paste again. If this persists, LCR's page structure may have changed.");
    const candidates = arrays.map(array => {
      if (array.length > ${MAX_SYNC_ROWS}) throw new Error("The list exceeds Wardly's ${MAX_SYNC_ROWS}-member limit.");
      const members = array.map(mapMember);
      const byId = new Map(members.map(member => [member.externalUuid, JSON.stringify(member)]));
      if (byId.size !== members.length) throw new Error("Duplicate member IDs. No export was created.");
      return { members, byId };
    }).sort((a, b) => b.members.length - a.members.length);
    const chosen = candidates[0];
    // Accept repeated lists and matching subsets, never combine unrelated lists.
    for (const candidate of candidates) {
      for (const [id, value] of candidate.byId) {
        if (chosen.byId.get(id) !== value) throw new Error("Conflicting member lists were found. Reload the full directory and try again. No export was created.");
      }
    }
    const json = JSON.stringify(chosen.members, null, 2);
    if (new TextEncoder().encode(json).length > ${MAX_SYNC_BYTES}) throw new Error("Export exceeds Wardly's 5 MB import limit.");
    state.json = json;
    state.count = chosen.members.length;
    state.status = "ready";
    console.log("Wardly: exported " + state.count + " members. Check this matches the full directory count before syncing.");
    const unknownBaptism = chosen.members.filter(member => member.isBaptized === undefined).length;
    chosen.members.filter(member => member.isBaptized === undefined).forEach(member => console.log(member));
    if (unknownBaptism) console.log("Wardly: " + unknownBaptism + " members have no baptism flag. Existing values will be preserved; new members default to not baptized and need review.");
    console.log(json);
    let copied = false;
    if (copyToClipboard) {
      try { copyToClipboard(json); copied = true; } catch { /* Console fallback below. */ }
    }
    console.log(copied
      ? "Copied! Return to Wardly and paste into the sync box."
      : "Run copy(wardlyLcr.json), then paste into Wardly's sync box.");
  } catch (error) {
    state.status = "error";
    console.error("Wardly: " + error.message);
  }
})(typeof copy === "function" ? copy : null);`;

// Reads the data from the HTML document on:
// https://lcr.churchofjesuschrist.org/mlt/records/member-list?lang=eng
// Note: Could be extended to also read uuid (set as id on the row) and household
//       information by clicking on housholds and then reading the infos there.
// export const LCR_SCRIPT = `function parseDateString(input) {
//   const [day, monthStr, year] = input.split(' ');

//   const months = { Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06', Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12' };

//   const month = months[monthStr];
//   if (!month) throw new Error('Invalid month');

//   return \`\${year}-\${month}-\${day.padStart(2, '0')}\`;
// }

// Array.from(document.querySelectorAll("#individuals tbody tr"))
// .map(row => {
//   const columns = Array.from(row.querySelectorAll("td"));
//   const nameCell = columns[1];
//   const name = nameCell.querySelector("button").innerText;
//   const nameSplit = name.split(", ");
//   const firstName = nameSplit.length > 1 ? nameSplit[1] : nameSplit[0];
//   const lastName = nameSplit.length > 1 ? nameSplit[0] : "";
//   const isBaptized = !nameCell.innerText.toLowerCase().includes("not baptized");
//   const gender = columns[2].innerText.toLowerCase();
//   const email = columns[6].innerText ? columns[6].innerText : null;
//   const birthDateRaw = columns[4].innerText;
//   const birthDate = birthDateRaw ? parseDateString(birthDateRaw) : null;
//   return {firstName, lastName, gender, birthDate, email, isBaptized};
// });`;
