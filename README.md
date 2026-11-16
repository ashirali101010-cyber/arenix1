# Arenix

A football and futsal tournament workspace built with React, NestJS and hosted Supabase PostgreSQL. Supports registration approvals, three formats, scheduling, assigned scoring, standings, brackets, public results and audit history.

## Set up on a Mac

Install **Node.js 24 LTS** from [nodejs.org](https://nodejs.org/en/download), then open this project folder in Terminal.

```bash
npm ci
npm run setup:env
```

Create a development project in the [Supabase Dashboard](https://supabase.com/dashboard). Copy its **Session pooler URI** from **Connect**. Download its server root certificate from **Database settings → SSL Configuration**, save it in the project folder as `supabase-ca.crt`, and fill these lines in `.env`:

```dotenv
DATABASE_URL="PASTE THE SESSION POOLER URI"
DATABASE_PASSWORD="YOUR DATABASE PASSWORD"
DATABASE_CA_FILE=./supabase-ca.crt
```

Leave the password placeholder in the copied URI. The separate password setting handles URL encoding. Keep the generated JWT secret and default app ports unchanged.

```bash
npm run db:setup
npm run dev
```

Open **http://127.0.0.1:5180**. API health: **http://127.0.0.1:3001/api/health**. Your data persists in Supabase when the app stops. No Docker, local PostgreSQL or Supabase CLI installation is needed.

The [complete macOS guide](docs/setup-guide.md) covers configuration, roles and troubleshooting. The editable Word guides are in `output/documents`.

## Sample accounts

| Role          | Email                 |
| ------------- | --------------------- |
| Organizer     | organizer@arenix.test |
| Team manager  | manager@arenix.test   |
| Scorer        | scorer@arenix.test    |
| Administrator | admin@arenix.test     |

Password for all four: **ArenixDemo!2026**. Seed only a development project. Existing accounts and tournaments are preserved; repeating the seed does not reset passwords or refresh dates.

## Daily use

Run `npm run dev` from the project folder. Press **Control C** to stop. Restart after editing `.env`. Keep `127.0.0.1` consistent with `APP_ORIGIN`.

Organizer flow: create tournament → approve teams → add venues and slots → generate draw → auto-schedule → assign scorers → publish. Assigned scorers enter final results. Visitors use `/#/public` without signing in.

## Quick preview

```bash
npm run demo
```

This works without hosted credentials and uses **temporary** PostgreSQL data. Changes disappear when stopped. It does not verify a Supabase connection. Stop any running Arenix instance before switching modes.

## Checks

```bash
npm run typecheck
npm run test:coverage
npm run build
```

Tests use isolated PostgreSQL and never `.env`'s database. See [the verification record](docs/verification.md) for measured results and limits.

## Project layout

- `apps/web`: React interface and public pages.
- `apps/api`: NestJS API, authentication and persistence.
- `packages/core`: tournament, scheduling and standings rules.
- `supabase/migrations`: SQL files applied by the app's migration runner.
- `scripts`: environment setup, migrations, sample data and document builders.
- `tests`: core and API verification.
- `docs`: setup, project documentation and requirements.
- `output/documents`: editable Word files.

Authentication runs in NestJS; Supabase provides the hosted database and dashboard. Database credentials stay on the backend. The first version supports football and futsal; email delivery, server-pushed scores and PDF tournament exports remain future work. Source is published in the private Arenix repository; no public app deployment is configured.
