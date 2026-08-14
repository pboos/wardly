This project is using the following setup:
- React
- TypeScript
- NextJS
- shadcn for UI

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
