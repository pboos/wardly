This project is using the following setup:
- React
- TypeScript
- NextJS
- shadcn for UI

## Database
See [docs/DATABASE.md](docs/DATABASE.md) for anything related to the database.

## Design / UX
See [docs/DESIGN.md](docs/DESIGN.md) for anything related to design and ux guidelines.

## Environment variables
- Copy `.env.example` to `.env` and fill in the values. `.env.example` is committed to git; all other `.env*` files are gitignored and must **never** be committed.
- `.env` holds secrets such as `DATABASE_URL`, JWT signing keys, email-sending credentials, and any other runtime configuration.

<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->
