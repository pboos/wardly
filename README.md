This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

### Local demo (no email setup)

```bash
npm run dev:demo
```

Open [http://127.0.0.1:3000](http://127.0.0.1:3000), log in with
`demo@example.test`, then enter code **123456**. This prepares a separate local
database with German demo content and the `Europe/Zurich` timezone. Your edits
persist across restarts. Stop the server and run `npm run demo:reset` to start over.
Normal server startup never adds demo data.

For other demo users, automation, and email-free login with your own local data,
see [local development](docs/features/local-development/README.md).

### Environment variables
- Copy `.env.example` to `.env` and fill in the values. `.env.example` is committed to git; all other `.env*` files are gitignored and must **never** be committed.
- `.env` holds secrets such as `DATABASE_URL`, JWT signing keys, email-sending credentials, and any other runtime configuration.

### Run the development server:

Generate prisma code:
```bash
bun prisma generate
```

Create db & run migrations
```bash
bun prisma migrate dev
```

```bash
bun dev
# or: npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Deploy to server

```bash
docker build -t wardly:latest .
docker save wardly:latest | gzip > wardly.tar.gz
scp wardly.tar.gz user@your-server:/tmp/
ssh user@your-server 'gunzip -c /tmp/wardly.tar.gz | docker load'
```
