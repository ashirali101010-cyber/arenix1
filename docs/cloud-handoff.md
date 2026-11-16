# Developer continuation

Latest setup decision on 2 November 2026: use hosted Supabase PostgreSQL and a simple macOS setup. Docker and the Supabase CLI have been removed from the project. Preserve React, NestJS, the existing tournament workflows and the two editable Word deliverables.

Read README.md and docs/setup-guide.md for the current setup. Install Node.js 24, run npm ci and npm run setup:env, fill the hosted Session pooler URI and separate database password, then run npm run db:setup and npm run dev. Store the downloaded root certificate as supabase-ca.crt. Never disable database certificate verification or commit credentials.

Normal runs use hosted Supabase. npm run demo uses temporary PostgreSQL data and does not verify a hosted connection. Tests use isolated PostgreSQL and never the configured development project.

Prior verified results: 120 tests passed on 1 November, including 100 generated tournament cases. See docs/verification.md for the current checks. No real pilot, SUS result or production load result is claimed. A hosted database connection still requires project credentials and has not been exercised in this workspace. The macOS instructions must not be described as an actual Mac execution test.

Keep public app deployment separate from development and document work. The private repository exists, but no Codex Cloud environment or public app hosting is configured.
