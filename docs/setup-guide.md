# Arenix macOS Setup Guide

React NestJS and hosted Supabase

This guide runs Arenix on a Mac with its data stored in a hosted Supabase project. Install Node.js, configure the database connection once, and start the app with npm. Docker and the Supabase CLI are not required.

## 1 Install Node

Install Node.js 24 LTS using the macOS installer from https://nodejs.org/en/download. Choose the version for your Mac processor, Apple Silicon or Intel. The installer includes npm. Open Terminal and check both commands return a version.

```bash
node --version
npm --version
```

## 2 Open the project

Download the updated Arenix project ZIP supplied with this guide and unzip it in Finder. Open the folder containing package.json in Terminal. You can type cd followed by a space, drag that folder from Finder into Terminal, and press Return. If you already use Git, cloning the repository works too.

Run these commands in that project folder.

```bash
npm ci
npm run setup:env
```

The first command installs the locked dependencies. The second creates .env with a random session secret. It preserves an existing .env. Open that file in a plain text editor or VS Code; keep its name exactly .env.

## 3 Create the Supabase database

Sign in at https://supabase.com/dashboard and create a project for development. Keep the database password you choose. Wait until the project is ready.

In the project's Connect dialog, select Session pooler and copy its PostgreSQL URI. Copy the host, port and username exactly as shown. Leave the password placeholder in that URI; Arenix reads the actual password from a separate setting.

In Database settings, find SSL Configuration and download the server root certificate. Copy it into the Arenix project folder and rename it supabase-ca.crt. This lets the backend verify its encrypted connection to the database. The certificate and .env are ignored by Git.

<!-- PAGE -->

## 4 Fill in the database settings

Edit these three lines in .env. Use your own project's copied URI and password, and keep the quotation marks around values. The separate password field handles reserved characters without manual URL encoding.

```dotenv
DATABASE_URL="PASTE YOUR SESSION POOLER URI HERE"
DATABASE_PASSWORD="YOUR DATABASE PASSWORD"
DATABASE_CA_FILE=./supabase-ca.crt
```

The database password is the one chosen when creating the Supabase project, not your Supabase account login password. It must be readable by dotenv: if it contains a double quote, use single quotes around the value, or use a password without quote characters for the development project.

Leave the generated JWT_SECRET and the following defaults in place.

```dotenv
PORT=3001
APP_ORIGIN=http://127.0.0.1:5180
NODE_ENV=development
```

Only NestJS receives the connection settings. React does not need a Supabase API key or database password. Supabase Auth is not used; the application handles accounts and sessions in NestJS.

## 5 Prepare the data and start

```bash
npm run db:setup
npm run dev
```

The setup command creates the tables from the SQL migrations and inserts synthetic sample data into your development project. Run it against a development database. Repeating it skips applied migrations and preserves existing sample accounts and tournaments.

Open http://127.0.0.1:5180 in the browser. The API health address is http://127.0.0.1:3001/api/health. It should return a status of ok. You can inspect tables in the hosted Supabase Dashboard by selecting the arenix schema.

## Sign in

All sample accounts use the password ArenixDemo!2026.

| Role          | Email                 |
| ------------- | --------------------- |
| Organizer     | organizer@arenix.test |
| Team manager  | manager@arenix.test   |
| Scorer        | scorer@arenix.test    |
| Administrator | admin@arenix.test     |

The sample Campus Champions Cup includes eight teams and recorded results. The Winter Football League is open for registration. Sample dates are based on the day the seed first runs. Repeating the seed does not refresh existing dates or reset passwords.

<!-- PAGE -->

## Everyday use

To start on another day, open the project folder in Terminal and run npm run dev. To stop, press Control C in that terminal. Your hosted Supabase data remains saved. Restart the API after editing .env.

Use http://127.0.0.1:5180 consistently. If you use localhost instead, its origin will not match the configured session and request checks. Times display in the browser's timezone and are stored as UTC timestamps.

## Organizer workflow

1. Create a tournament with future match dates and registration deadline. Choose football or futsal, one of the three formats, capacity of 4 to 32 teams, roster limits and a rest gap.
2. Ask managers to create teams and submit their rosters before the deadline. Approve at least four teams in Teams and registrations.
3. Add venues and time slots within the tournament dates. Generate a random draw or specify the manual seed order. A random draw records its seed.
4. Open Match center and auto-schedule. Add capacity if matches remain unplaced. Assign active scorers to the matches and publish the fixtures.
5. Use Manage match for a later schedule change. The app rejects venue clashes, team clashes and inadequate rest. Published draws cannot be regenerated.

For groups, choose 2, 4, 8 or 16 groups with at least two teams each. Two teams qualify per group. Once every group result is final, the knockout bracket is created and scheduling is attempted. Check those new fixtures and assign their scorers.

## Managers scorers and public visitors

Managers create a team and enter one player per roster line, with a unique squad number followed by a full name, such as 7 Ali Khan. They select an open tournament and register. Registration saves a roster snapshot; editing the master roster later does not silently change an approved registration.

Scorers can enter results only for their assigned matches. Enter whole-number goals from 0 to 99. A tied knockout needs decisive penalties. To correct a submitted result, enter the replacement score and a reason, then request organizer approval. Refresh when a stale-version message appears.

Public visitors open /#/public without logging in. They see fixtures, final results, standings and brackets. Private rosters and account emails remain hidden. Visible public pages refresh every two seconds.

Admins can deactivate or reactivate accounts and inspect the audit log. Activation changes invalidate existing sessions. An admin cannot deactivate their own account through this screen.

<!-- PAGE -->

## Troubleshooting

| Problem                         | What to check                                                                                                                                     |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| node or npm not found           | Install Node.js 24 using the macOS installer, then open a new Terminal window.                                                                    |
| npm cannot find package.json    | Open Terminal in the extracted project folder before running commands.                                                                            |
| Missing database settings       | Fill DATABASE_URL and DATABASE_PASSWORD in .env using your own Supabase project.                                                                  |
| Password authentication failed  | Check the database password and copy the complete Session pooler username from Connect.                                                           |
| Cannot read certificate         | Put the downloaded certificate in the project folder as supabase-ca.crt, matching DATABASE_CA_FILE.                                               |
| Certificate verification failed | Download the current root certificate from your project's Database settings. Keep certificate verification enabled.                               |
| Connection timeout              | Confirm the hosted project is ready and reachable. Copy the Session pooler URI, rather than inventing its host or using a transaction-pooler URI. |
| Missing table                   | Run npm run db:setup against the intended development project.                                                                                    |
| Origin not allowed              | Use 127.0.0.1:5180, and ensure APP_ORIGIN matches it exactly. Restart the API after changing .env.                                                |
| Port already in use             | Stop the existing Arenix terminal with Control C. If using another web port, update APP_ORIGIN and start the web server with that port.           |

## Optional checks

```bash
npm run typecheck
npm run test:coverage
npm run build
```

Tests use isolated in-memory PostgreSQL and never the configured hosted database. For a quick preview without a Supabase project, run npm run demo. It uses the same interface and API with temporary sample data; changes disappear when it stops. Stop any other Arenix instance before switching modes.

The setup steps target macOS. Current automated verification and its limits are recorded in docs/verification.md. The project documentation explains the architecture, rules and API; it is separate from this installation guide.

## References

- Node.js macOS downloads: https://nodejs.org/en/download
- Supabase connections and certificates: https://supabase.com/docs/guides/database/connecting-to-postgres
- node-postgres TLS configuration: https://node-postgres.com/features/ssl
