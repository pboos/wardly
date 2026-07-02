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
- Copy `.env.example` to `.env` and fill in the values. `.env.example` is committed to git; all other `.env*` files are gitignored and must **never** be committed.
- `.env` holds secrets such as `DATABASE_URL`, JWT signing keys, email-sending credentials, and any other runtime configuration.

## Auth / Login flow
- Email → `login` row (random `token` + 6-char `code`) → SMTP email (Mailgun) → verify by **code** (`/login`) or **magic link** (`/login/verify?token=…`) → signed JWT in an `HttpOnly`, `Secure`, `SameSite=Lax` cookie.
- JWT lives 4h and is refreshed when <1h remains (handled in the DAL, `lib/auth/dal.ts`).
- Login rows expire after 5 min (`LOGIN_TTL_MS`); cleaned up lazily in the login actions and by the cron route `GET /api/cron/cleanup-logins` (protected by `CRON_SECRET` bearer token).
- `/logout` (GET) clears the cookie and redirects to `/login`; it is public so it works with a stale cookie.
- No user enumeration: `requestLogin` always returns `email_sent` whether or not the user exists.
- Code attempts are capped at `MAX_LOGIN_ATTEMPTS` (3); on exhaustion all login rows for that user are deleted.
- The main page (`/`) reads the name from the JWT payload (`CLAIM_NAME`) and renders `Hello {name}` — no DB call.
- Route protection: `proxy.ts` does an optimistic cookie-only check (no DB calls) and redirects unauthenticated users to `/login`; real authorization happens in the DAL (`verifySession` / `getCurrentUser`).
- Redirect-after-login: when an unauthenticated user is bounced to `/login` by `proxy.ts`, the original path is preserved as a `?redirect=` query param (via `buildLoginUrl`). The login form carries it through a hidden input; `requestLogin` stores the sanitized value in `login.redirect_path`; after successful login (code flow via `verifyCode` or magic link via `/login/verify`), the user is redirected back to that path. Validation lives in `lib/auth/redirect.ts` (`sanitizeRedirect`) — it blocks open-redirect vectors (protocol-relative `//`, backslash, absolute URLs, control chars) and login/logout loop paths, and is applied at both write and read time.

## Auth constants
- All cookie names, JWT claim keys, and lifetimes live in [`lib/auth/constants.ts`](lib/auth/constants.ts) — never inline these literals elsewhere.

<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->
