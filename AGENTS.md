# Arenix implementation guidance

Keep the accepted stack: React, NestJS and Supabase PostgreSQL. Complete the existing implementation rather than replacing it with a demo or a static mockup. Read docs/cloud-handoff.md and docs/requirements.md before continuing.

Football and futsal are the supported sports. Preserve all three formats, role and ownership checks, match assignment checks, deterministic draws, rest and overlap checks, optimistic match versions, atomic result progression, privacy-safe public views and audit history.

Use npm ci for locked dependencies. Run npm run typecheck and npm run build after source changes. Run the relevant tests, including npm run test:coverage for core rule changes. Tests use isolated PostgreSQL and never the configured persistent database. Do not reset any user database or seed production with sample accounts.

Store credentials in ignored environment files or cloud secrets. Never commit .env, database passwords, tokens, node_modules, dist, coverage or temporary files. Public app deployment is not authorized by a request to run development in Codex Cloud.

Maintain the two document Markdown sources and their editable Word outputs. Use the Documents skill and render and inspect every page before final delivery. Do not claim pilot, SUS, load, database or browser results that have not actually been measured. The current verification status is recorded in docs/verification.md.
