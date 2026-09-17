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

test("sync preserves omitted emails through preview and commits, but honors explicit changes", async () => {
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
    merges: [],
    ...overrides,
  });
  try {
    await prisma.ward.create({
      data: { id: "sync-test-ward", name: "Test ward", time_zone: "UTC" },
    });
    const existing = await prisma.member.create({
      data: {
        ward_id: "sync-test-ward",
        first_name: "Alex",
        last_name: "Example",
        gender: "m",
        birth_date: "2000-02-29",
        is_baptized: true,
        email: "saved@example.test",
        status: "active",
      },
    });
    const saved = () =>
      prisma.member.findUniqueOrThrow({ where: { id: existing.id } });
    const preview = (row) => parseSync(JSON.stringify([row]));
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
    // The form passes incoming optional fields through for normal/ambiguous updates.
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
    assert.equal(diff.possibleNameChanges.length, 1);
    await commitSync(
      plan({
        merges: [
          { existingId: existing.id, ...diff.possibleNameChanges[0].incoming },
        ],
      }),
    );
    assert.equal((await saved()).email, "saved@example.test");
    assert.equal((await saved()).last_name, "Renamed");

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
    });
    await commitSync(plan({ inserts: sourceDiff.new }));
    const inserted = await prisma.member.findFirstOrThrow({
      where: { first_name: "SourceExport" },
    });
    assert.notEqual(inserted.id, extras.externalUuid);
    assert.equal(inserted.ward_id, "sync-test-ward");
    assert.equal(inserted.status, "active");
    assert.equal(inserted.email, null);
    assert.equal(inserted.is_baptized, true);
    assert.equal(Object.hasOwn(inserted, "lcr"), false);
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
          merges: [
            {
              existingId: existing.id,
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
        inserts: [{ ...incoming, firstName: "Unknown", isBaptized: undefined }],
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
    await commitSync(plan({ inserts: [{ ...incoming, firstName: "New" }] }));
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
