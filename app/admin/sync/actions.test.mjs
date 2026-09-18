import assert from "node:assert/strict";
import test from "node:test";
import { registerHooks } from "node:module";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import Database from "better-sqlite3";

// Stub only the signed-in identity; exercise the real preview, commit, and DB.
registerHooks({
  resolve(specifier, context, nextResolve) {
    if (specifier === "@/lib/auth/dal") {
      return {
        shortCircuit: true,
        url: 'data:text/javascript,export async function getCurrentUser() { return { ward_id: "sync-test-ward" }; }',
      };
    }
    return nextResolve(specifier, context);
  },
});

test("sync matches UUIDs, persists households, isolates wards, and preserves unknown fields", async () => {
  const directory = mkdtempSync(join(tmpdir(), "wardly-sync-test-"));
  process.env.DATABASE_URL = `file:${join(directory, "test.db")}`;
  const db = new Database(join(directory, "test.db"));
  db.exec(
    readFileSync(
      new URL(
        "../../../prisma/migrations/20260627162827_init/migration.sql",
        import.meta.url,
      ),
      "utf8",
    ),
  );
  db.close();
  const { prisma } = await import("../../../lib/prisma.ts");
  const { parseSync, commitSync } = await import("./actions.ts");
  const incoming = {
    externalUuid: "member-alex",
    firstName: "Alex",
    lastName: "Example",
    gender: "m",
    birthDate: "2000-02-29",
    isBaptized: true,
  };
  const plan = (overrides) => ({
    inserts: [],
    moves: [],
    updates: [],
    ...overrides,
  });
  try {
    await prisma.ward.create({
      data: { id: "sync-test-ward", name: "Test ward", time_zone: "UTC" },
    });
    const existing = await prisma.member.create({
      data: {
        ward_id: "sync-test-ward",
        external_uuid: incoming.externalUuid,
        first_name: "Alex",
        last_name: "Example",
        gender: "m",
        birth_date: "2000-02-29",
        is_baptized: true,
        email: "saved@example.test",
        status: "active",
      },
    });
    const task = await prisma.task.create({
      data: {
        ward_id: "sync-test-ward",
        member_id: existing.id,
        type: "member_welcome",
      },
    });
    const saved = () =>
      prisma.member.findUniqueOrThrow({ where: { id: existing.id } });
    const preview = (row) => parseSync(JSON.stringify([row]));
    for (const [gender, expected] of [
      ["m", "m"],
      ["f", "f"],
      [" M ", "m"],
      [" F ", "f"],
      ["MALE", "m"],
      ["female", "f"],
    ]) {
      const row = { ...incoming, externalUuid: `gender-${gender.trim()}`, gender };
      const result = await preview(row);
      assert.equal(result.new[0].gender, expected);
      // Send the original alias to exercise commit's independent normalization.
      await commitSync(plan({ inserts: [row] }));
      const savedGender = await prisma.member.findFirstOrThrow({
        where: { external_uuid: row.externalUuid },
      });
      assert.equal(savedGender.gender, expected);
      await prisma.member.delete({ where: { id: savedGender.id } });
    }
    for (const gender of [
      undefined,
      null,
      "",
      " ",
      "unknown",
      "other",
      1,
      {},
      [],
    ]) {
      const row = { ...incoming, gender };
      assert.match((await preview(row)).error, /gender/);
      await assert.rejects(commitSync(plan({ inserts: [row] })), /gender/);
      await assert.rejects(
        commitSync(plan({ updates: [{ ...row, id: existing.id }] })),
        /gender/,
      );
    }

    let diff = await preview(incoming);
    assert.equal(diff.unchanged.length, 1);
    assert.equal(diff.updated.length, 0);

    await prisma.member.update({
      where: { id: existing.id },
      data: { status: "moved" },
    });
    diff = await preview({ ...incoming, isBaptized: false });
    assert.equal(diff.updated.length, 1);
    assert.equal(diff.updated[0].changes.email, undefined);
    assert.equal(diff.updated[0].reactivate, true);
    // The form passes incoming optional fields through for UUID updates.
    await commitSync(
      plan({
        updates: [
          {
            id: existing.id,
            ...diff.updated[0].incoming,
            reactivate: true,
          },
        ],
      }),
    );
    assert.equal((await saved()).email, "saved@example.test");
    assert.equal((await saved()).is_baptized, false);
    assert.equal((await saved()).status, "active");

    diff = await preview({ ...incoming, lastName: "Renamed" });
    assert.equal(diff.updated.length, 1);
    assert.deepEqual(diff.updated[0].changes.last_name, {
      from: "Example",
      to: "Renamed",
    });
    await commitSync(
      plan({
        updates: [
          { id: existing.id, ...diff.updated[0].incoming, reactivate: false },
        ],
      }),
    );
    assert.equal((await saved()).email, "saved@example.test");
    assert.equal((await saved()).last_name, "Renamed");
    assert.equal(
      (await prisma.task.findUniqueOrThrow({ where: { id: task.id } }))
        .member_id,
      existing.id,
    );

    for (const [email, expected] of [
      ["new@example.test", "new@example.test"],
      [null, null],
      ["", null],
    ]) {
      diff = await preview({ ...incoming, lastName: "Renamed", email });
      if (diff.updated.length) {
        assert.equal(diff.updated[0].changes.email.to, expected);
        await commitSync(
          plan({
            updates: [
              {
                id: existing.id,
                ...diff.updated[0].incoming,
                reactivate: false,
              },
            ],
          }),
        );
      }
      assert.equal((await saved()).email, expected);
    }
    // Full exports may contain future fields, but only the import allowlist reaches the plan/DB.
    const extras = {
      externalUuid: "source-member-id",
      externalHouseholdUuid: "source-household-id",
      externalHouseholdRole: "HEAD",
      phone: "123",
      status: "hidden",
      ward_id: "other-ward",
      lcr: {
        uuid: "source-member-id",
        phone: "123",
        nameFormats: { spokenPreferredLocal: "Alias" },
        firstName: "Wrong",
        email: "source-only@example.test",
        isBaptized: false,
        futureField: "x".repeat(1_100_000),
      },
    };
    const sourceDiff = await preview({
      ...incoming,
      firstName: "SourceExport",
      ...extras,
    });
    assert.equal(sourceDiff.new.length, 1);
    assert.deepEqual(sourceDiff.new[0], {
      ...incoming,
      firstName: "SourceExport",
      email: undefined,
      externalUuid: extras.externalUuid,
      externalHouseholdUuid: extras.externalHouseholdUuid,
      externalHouseholdRole: extras.externalHouseholdRole,
    });
    await commitSync(plan({ inserts: sourceDiff.new }));
    const inserted = await prisma.member.findFirstOrThrow({
      where: { first_name: "SourceExport" },
    });
    assert.notEqual(inserted.id, extras.externalUuid);
    assert.equal(inserted.external_uuid, extras.externalUuid);
    assert.equal(
      inserted.external_household_uuid,
      extras.externalHouseholdUuid,
    );
    assert.equal(inserted.external_household_role, "HEAD");
    assert.equal(inserted.ward_id, "sync-test-ward");
    assert.equal(inserted.status, "active");
    assert.equal(inserted.email, null);
    assert.equal(inserted.is_baptized, true);
    assert.equal(Object.hasOwn(inserted, "lcr"), false);
    // UUID identity wins even when all demographic fields change.
    diff = await preview({
      ...incoming,
      firstName: "Different",
      lastName: "Person",
      gender: "f",
      birthDate: "1999-01-01",
      externalHouseholdUuid: "household-2",
      externalHouseholdRole: "SPOUSE",
    });
    assert.equal(diff.new.length, 0);
    assert.equal(diff.updated[0].existing.id, existing.id);
    await commitSync(
      plan({ updates: [{ id: existing.id, ...diff.updated[0].incoming }] }),
    );
    assert.equal((await saved()).external_household_uuid, "household-2");
    assert.equal((await saved()).external_household_role, "SPOUSE");
    assert.equal((await saved()).gender, "f");
    diff = await preview({ ...incoming, lastName: "Renamed" });
    await commitSync(
      plan({ updates: [{ id: existing.id, ...diff.updated[0].incoming }] }),
    );
    assert.equal((await saved()).external_household_uuid, "household-2");
    diff = await preview({
      ...incoming,
      lastName: "Renamed",
      externalHouseholdUuid: null,
      externalHouseholdRole: "",
    });
    await commitSync(
      plan({ updates: [{ id: existing.id, ...diff.updated[0].incoming }] }),
    );
    assert.equal((await saved()).external_household_uuid, null);
    assert.equal((await saved()).external_household_role, null);
    // Identical names and birth dates with different UUIDs never merge.
    diff = await preview({
      ...incoming,
      externalUuid: "different-id",
      lastName: "Renamed",
    });
    assert.equal(diff.new.length, 1);
    assert.ok(diff.moved.some((member) => member.id === existing.id));
    for (const externalUuid of [undefined, null, "", "  ", 12]) {
      assert.ok("error" in (await preview({ ...incoming, externalUuid })));
    }
    assert.ok("error" in (await parseSync("[]")));
    assert.ok(
      "error" in (await parseSync(JSON.stringify([incoming, incoming]))),
    );
    for (const key of ["externalHouseholdUuid", "externalHouseholdRole"]) {
      assert.ok("error" in (await preview({ ...incoming, [key]: 12 })));
    }
    await assert.rejects(
      commitSync(plan({ inserts: [incoming, incoming] })),
      /duplicate/,
    );
    await assert.rejects(
      commitSync(
        plan({
          updates: [{ ...incoming, id: existing.id, externalUuid: "wrong-id" }],
        }),
      ),
      /identity/,
    );
    await prisma.ward.create({ data: { id: "other-ward", name: "Other" } });
    const other = await prisma.member.create({
      data: {
        ward_id: "other-ward",
        external_uuid: incoming.externalUuid,
        first_name: "Other",
        last_name: "Ward",
        gender: "m",
        is_baptized: false,
      },
    });
    await assert.rejects(
      commitSync(plan({ updates: [{ ...incoming, id: other.id }] })),
      /identity/,
    );
    await assert.rejects(
      commitSync(plan({ moves: [other.id] })),
      /unavailable/,
    );
    const local = await prisma.member.create({
      data: {
        ward_id: "sync-test-ward",
        first_name: "Local",
        last_name: "Member",
        gender: "m",
        is_baptized: false,
      },
    });
    diff = await preview({ ...incoming, lastName: "Renamed" });
    assert.ok(!diff.moved.some((member) => member.id === local.id));
    await commitSync(plan({ moves: [inserted.id] }));
    assert.equal(
      (await prisma.member.findUniqueOrThrow({ where: { id: inserted.id } }))
        .status,
      "moved",
    );
    await assert.rejects(commitSync(plan({ inserts: [incoming] })));
    const oversized = await preview({
      ...incoming,
      lcr: { value: "x".repeat(5_000_000) },
    });
    assert.match(oversized.error, /5 MB/);

    // Missing/null baptism must not turn an existing baptized member into false.
    for (const unknown of [undefined, null]) {
      await prisma.member.update({
        where: { id: existing.id },
        data: { is_baptized: true },
      });
      diff = await preview({
        ...incoming,
        lastName: "Renamed",
        isBaptized: unknown,
      });
      assert.equal(diff.unchanged.length, 1);
      diff = await preview({
        ...incoming,
        lastName: "Renamed",
        email: "updated@example.test",
        isBaptized: unknown,
      });
      if (diff.updated.length) {
        assert.equal(diff.updated[0].changes.is_baptized, undefined);
        await commitSync(
          plan({
            updates: [
              {
                id: existing.id,
                ...diff.updated[0].incoming,
                reactivate: true,
              },
            ],
          }),
        );
      }
      assert.equal((await saved()).is_baptized, true);
      await commitSync(
        plan({
          updates: [
            {
              id: existing.id,
              ...incoming,
              lastName: "Renamed",
              isBaptized: undefined,
            },
          ],
        }),
      );
      assert.equal((await saved()).is_baptized, true);
    }
    for (const invalid of ["false", "true", 0, 1, {}]) {
      assert.ok(
        "error" in (await preview({ ...incoming, isBaptized: invalid })),
      );
    }
    await commitSync(
      plan({
        inserts: [
          {
            ...incoming,
            externalUuid: "member-unknown",
            firstName: "Unknown",
            isBaptized: undefined,
          },
        ],
      }),
    );
    assert.equal(
      (
        await prisma.member.findFirstOrThrow({
          where: { first_name: "Unknown" },
        })
      ).is_baptized,
      false,
    );
    assert.ok("error" in (await preview({ ...incoming, email: 42 })));
    await commitSync(
      plan({
        inserts: [
          { ...incoming, externalUuid: "member-new", firstName: "New" },
        ],
      }),
    );
    assert.equal(
      (await prisma.member.findFirstOrThrow({ where: { first_name: "New" } }))
        .email,
      null,
    );
  } finally {
    await prisma.$disconnect();
    rmSync(directory, { recursive: true, force: true });
  }
});
