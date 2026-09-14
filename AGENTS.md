This project is using the following setup:
- React
- TypeScript
- NextJS
- shadcn for UI

## Feature context and documentation

- Before working on a feature, consult [docs/features/README.md](docs/features/README.md), read its feature overview, and load only the topic documents relevant to the task.
- Use the implementation links to verify details in source code. If the documentation and implementation disagree, investigate and correct the documentation as part of the work.
- Update affected feature documentation in the same change whenever behavior, rules, data flow, or implementation entry points change. Add new features to the feature index.
- Keep documentation compact: start with one overview per feature and split substantial topics by behavior/task when selective reading is useful. Follow the structure in the feature index.
- Document implemented behavior and current limitations; keep proposals and historical plans in `docs/plans/`. Link to database/design references instead of duplicating their rules.

## Database
See [docs/DATABASE.md](docs/DATABASE.md) for anything related to the database.

## Design / UX
See [docs/DESIGN.md](docs/DESIGN.md) for anything related to design and ux guidelines.
Always make it responsive & support mobile devices.

## Environment variables
- `.env` holds secrets such as `DATABASE_URL`, JWT signing keys, email-sending credentials, and any other runtime configuration.
  - Add to `.env` and `.env.example`. Only `.env.example` gets committed to git.

## Auth constants
- All cookie names, JWT claim keys, and lifetimes live in [`lib/auth/constants.ts`](lib/auth/constants.ts) — never inline these literals elsewhere.

## General guidelines
- Each react component into an own .tsx file
- No .ts and .tsx files bigger than 300-500 lines of code.

<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->
