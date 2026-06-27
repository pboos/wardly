# Database Setup

This project uses **Prisma ORM** with **SQLite**.

- ORM: [Prisma](https://www.prisma.io/docs/) v7+ (ESM-first `prisma-client` generator + driver adapter).
- Database: SQLite (file-based, `prisma/dev.db` in development).
- Config: `prisma.config.ts` at the project root (replaces the `url` in the `datasource` block).
- Schema: [`docs/DATABASE_SCHEMA.md`](./DATABASE_SCHEMA.md) — the canonical table/field/index reference.
- Client: `lib/prisma.ts` — a singleton `PrismaClient` (uses `@prisma/adapter-better-sqlite3`).

---

## Conventions

- **Table names are singular** (`ward`, `user`, `member`, ...). This applies across code, API routes, and database references.
- All primary keys are UUIDs stored as `TEXT` (Prisma `@default(uuid())`).
- Timestamps are stored as `TEXT` in ISO‑8601. Prisma `DateTime` maps to TEXT in SQLite and `@default(now())` emits an ISO‑8601 string at insert time.
- Every table has `created_at` and `updated_at` columns.
- Foreign keys use `onDelete: Cascade` (or `Set Null` where noted in the schema) — see [`docs/DATABASE_SCHEMA.md`](./DATABASE_SCHEMA.md).

---

## Environment

The database URL is read from `.env` via `dotenv`. Copy `.env.example` to `.env` and adjust as needed:

```bash
cp .env.example .env
```

`.env.example` is committed to git; all other `.env*` files are gitignored. See [AGENTS.md](../AGENTS.md) for the full environment-variable policy.

---

## Files

| File | Purpose |
|------|---------|
| `prisma/schema.prisma` | The Prisma schema (models, relations, indexes). |
| `prisma.config.ts` | Prisma CLI config — schema path, migrations path, datasource URL. |
| `prisma/migrations/` | Versioned migration files (committed to git). |
| `prisma/dev.db` | The SQLite database file (gitignored, dev only). |
| `generated/prisma/` | The generated Prisma Client (gitignored). |
| `lib/prisma.ts` | The `PrismaClient` singleton used by the app. |

---

## npm scripts

| Script | Command | Description |
|--------|---------|-------------|
| `db:migrate` | `prisma migrate dev` | Create + apply a new migration from schema changes. |
| `db:generate` | `prisma generate` | Regenerate the Prisma Client (e.g. after pulling). |
| `db:studio` | `prisma studio` | Open Prisma Studio to inspect/edit data visually. |
| `db:reset` | `prisma migrate reset` | Drop and re-apply all migrations (destroys data). |

---

## How to add a new table / change the schema

1. **Edit the schema doc first.** Add or update the table definition in [`docs/DATABASE_SCHEMA.md`](./DATABASE_SCHEMA.md) (the SQL there is the source of truth for table/field/index naming and intent).
2. **Edit `prisma/schema.prisma`.** Add or modify the corresponding `model`. Follow the existing conventions:
   - Singular, lowercase model name matching the table name.
   - `id String @id @default(uuid())` primary key.
   - `created_at` / `updated_at` as `DateTime @default(now())`.
   - Replicate all indexes/unique constraints from the schema doc with `@@index` / `@@unique`.
   - Preserve `onDelete` behavior from the schema doc.
3. **Create a migration.** Run:

   ```bash
   bun run db:migrate
   ```

   Prisma will prompt for a migration name, generate `prisma/migrations/<timestamp>_<name>/migration.sql`, apply it to `prisma/dev.db`, and regenerate the client.
4. **Verify.** Review the generated `migration.sql` to confirm it matches the schema doc, then run:

   ```bash
   bunx prisma migrate status
   ```

> Only `ward`, `user`, `login`, and `member` are in the initial migration. The remaining tables (`meeting`, `agenda_item`, `meeting_agenda_item`, `task`, `task_state_transition`, `task_state`) will be added in later migrations — see [`docs/DATABASE_SCHEMA.md`](./DATABASE_SCHEMA.md) for their definitions.

---

## How to update the schema after pulling

After pulling changes that include new migrations or schema edits:

```bash
bunx prisma migrate dev
```

This applies any pending migrations and regenerates the client. If the generated client was gitignored and is missing, regenerate it explicitly:

```bash
bun run db:generate
```

---

## Migrations

- Migrations live in `prisma/migrations/` and **are committed to git**.
- The SQLite database file (`prisma/dev.db`) is **gitignored** and regenerated locally.
- Never use `prisma db push` for production-bound changes — always go through `prisma migrate dev` so changes are versioned and reviewable.
- To reset the local database (e.g. after a bad migration), run `bun run db:reset`. This drops all data and re-applies all migrations.

---

## Using the Prisma Client

Import the singleton from `lib/prisma.ts`:

```ts
import { prisma } from "@/lib/prisma";

const wards = await prisma.ward.findMany();
```

The singleton pattern avoids exhausting connections during Next.js hot reloading in development.
